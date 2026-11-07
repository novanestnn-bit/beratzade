import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { ApiService, PublicTenantMenuResponse } from '../services/api.service';
import { LanguageService } from '../services/language.service';
import { PublicMenuComponent } from './public-menu.component';

describe('public menu loading reliability', () => {
  let fixture: ComponentFixture<PublicMenuComponent>;
  let menu: PublicMenuComponent;
  let first: Subject<PublicTenantMenuResponse>, latest: Subject<PublicTenantMenuResponse>;
  const snapshot = (name: string) => ({ tenant_id:1, tenant_name:name, currency:'TRY', lang:'tr', categories:[] }) as PublicTenantMenuResponse;

  beforeEach(() => {
    first = new Subject(); latest = new Subject();
    TestBed.configureTestingModule({
      imports:[PublicMenuComponent, TranslateModule.forRoot()],
      providers:[
        { provide:ApiService, useValue:{ getPublicTenantMenu:jasmine.createSpy().and.returnValues(first, latest) } },
        { provide:ActivatedRoute, useValue:{} },
        { provide:Router, useValue:{} },
        { provide:LanguageService, useValue:{ getLanguage:() => 'tr' } },
      ],
    });
    TestBed.overrideComponent(PublicMenuComponent, { set:{ template:'' } });
    fixture = TestBed.createComponent(PublicMenuComponent);
    menu = fixture.componentInstance;
    menu.tenantId.set(1);
    spyOn<any>(menu, 'updateDocumentTitle').and.stub();
  });
  afterEach(() => fixture.destroy());

  it('finishes initial loading when a language refresh supersedes the first response', () => {
    (menu as any).loadMenu(1);
    (menu as any).reloadMenu(true);
    first.next(snapshot('Old language'));
    expect(menu.loading()).toBeTrue();
    latest.next(snapshot('Current language'));
    expect(menu.loading()).toBeFalse();
    expect(menu.menuLoading()).toBeFalse();
    expect(menu.menu()?.tenant_name).toBe('Current language');
  });

  it('shows a recoverable error instead of an endless spinner when the latest initial request fails', () => {
    (menu as any).loadMenu(1);
    (menu as any).reloadMenu(true);
    latest.error({ status:503 });
    expect(menu.loading()).toBeFalse();
    expect(menu.errorKind()).toBe('menu_load_failed');
    first.next(snapshot('Outdated response'));
    expect(menu.menu()).toBeNull();
  });

  it('retains the last successful catalogue during a connection failure', () => {
    (menu as any).loadMenu(1);
    const existing = snapshot('Restaurant');
    first.next(existing);
    (menu as any).reloadMenu(true);
    latest.error({ status:0 });
    expect(menu.menu()).toBe(existing);
    expect(menu.refreshFailed()).toBeTrue();
    expect(menu.errorKind()).toBeNull();
    expect(menu.menuLoading()).toBeFalse();
  });
});
