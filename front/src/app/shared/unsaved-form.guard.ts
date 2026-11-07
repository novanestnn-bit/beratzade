import { CanDeactivateFn } from '@angular/router';

export interface UnsavedForm {
  confirmCanDeactivate(): boolean;
}

export const unsavedFormGuard: CanDeactivateFn<UnsavedForm> = component => component.confirmCanDeactivate();
