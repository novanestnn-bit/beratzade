import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ApiErrorMessageService } from '../services/api-error-message.service';
import { LoginComponent } from './login.component';
import { loginPathFor, restaurantHome } from './login-destination';

describe('separate restaurant login portals', () => {
  function setup(portal: 'staff' | 'admin', role = 'waiter') {
    const api = {
      login: jasmine.createSpy().and.returnValue(of({})),
      loginWithOtp: jasmine.createSpy().and.returnValue(of({})),
      checkAuth: jasmine.createSpy().and.returnValue(of({ role, tenant_id: 1 })),
      logout: jasmine.createSpy().and.returnValue(of({})),
      getSaasSubscription: jasmine.createSpy().and.returnValue(of({ enabled: false, has_access: true })),
    };
    const router = { navigate: jasmine.createSpy().and.returnValue(Promise.resolve(true)) };
    TestBed.configureTestingModule({ imports: [LoginComponent, TranslateModule.forRoot()], providers: [
      { provide: ApiService, useValue: api }, { provide: Router, useValue: router },
      { provide: ApiErrorMessageService, useValue: { fromHttpError: () => 'error' } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { loginPortal: portal }, queryParams: {}, queryParamMap: convertToParamMap({}) } } },
    ] });
    TestBed.overrideComponent(LoginComponent, { set: { template: '' } });
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.form.setValue({ username: 'portal-test@amvara.de', password: 'isolated-not-a-real-password' });
    return { component, api, router };
  }

  it('routes staff to operational screens without granting admin access', () => {
    const { component, router } = setup('staff');
    component.onSubmit();
    expect(router.navigate).toHaveBeenCalledWith(['/staff/pos']);
  });
  it('rejects a staff password login through the admin portal', () => {
    const { component, api, router } = setup('admin');
    component.onSubmit();
    expect(api.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.error()).toBe('LOGIN_PORTAL.ADMIN_ONLY');
    expect(component.form.controls.password.value).toBe('');
  });
  it('applies the same role check after OTP verification', () => {
    const { component, api, router } = setup('admin');
    component.otpTempToken.set('isolated-otp-challenge'); component.otpCode = '123456';
    component.onSubmitOtp();
    expect(api.loginWithOtp).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('routes an owner to management after password login', () => {
    const { component, router } = setup('admin', 'owner');
    component.onSubmit(); expect(router.navigate).toHaveBeenCalledWith(['/settings']);
  });
  it('lets an administrator use the staff portal too', () => {
    const { component, router } = setup('staff', 'admin');
    component.otpTempToken.set('isolated-otp-challenge'); component.otpCode = '123456';
    component.onSubmitOtp(); expect(router.navigate).toHaveBeenCalledWith(['/staff/pos']);
  });
  it('does not navigate if the server cannot verify the signed-in user', () => {
    const { component, api, router } = setup('admin', 'owner');
    api.checkAuth.and.returnValue(throwError(() => new Error('offline')));
    component.onSubmit(); expect(router.navigate).not.toHaveBeenCalled(); expect(component.loading()).toBeFalse();
  });
  it('uses fixed role-specific destinations and separate anonymous entry points', () => {
    expect(restaurantHome('kitchen', 'staff')).toBe('/kitchen');
    expect(restaurantHome('bartender', 'staff')).toBe('/bar');
    expect(restaurantHome('receptionist', 'staff')).toBe('/tables');
    expect(loginPathFor('/settings?anything=1')).toBe('/admin/login');
    expect(loginPathFor('/staff/pos')).toBe('/staff/login');
    expect(loginPathFor('/settings-other')).toBe('/login');
  });
});
