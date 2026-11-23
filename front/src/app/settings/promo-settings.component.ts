import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, PricePromotion } from '../services/api.service';

@Component({
  selector: 'app-promo-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="section" data-testid="settings-promos-section">
      <div class="section-header">
        <h2>{{ 'SETTINGS.PROMOS_TITLE' | translate }}</h2>
        <p>{{ 'SETTINGS.PROMOS_SUBTITLE' | translate }}</p>
      </div>

      @if (loading()) {
        <p class="hint">{{ 'COMMON.LOADING' | translate }}</p>
      } @else {
        <div class="form-grid create-form" data-testid="promo-create-form">
          <label>
            <span>{{ 'SETTINGS.PROMOS_NAME' | translate }}</span>
            <input type="text" [(ngModel)]="draftName" />
          </label>
          <label>
            <span>{{ 'SETTINGS.PROMOS_PERCENT' | translate }}</span>
            <input type="number" min="1" max="100" [(ngModel)]="draftPercent" />
          </label>
          <label>
            <span>{{ 'SETTINGS.PROMOS_CATEGORY' | translate }}</span>
            <input
              type="text"
              [(ngModel)]="draftCategory"
              [placeholder]="'SETTINGS.PROMOS_CATEGORY_HINT' | translate"
            />
          </label>
          <label>
            <span>{{ 'SETTINGS.PROMOS_CHANNELS' | translate }}</span>
            <select [(ngModel)]="draftChannels">
              <option value="">{{ 'SETTINGS.PROMOS_CHANNELS_ALL' | translate }}</option>
              <option value="table">table</option>
              <option value="satisfecho_delivery">Beratzade delivery</option>
              <option value="marketplace">marketplace</option>
            </select>
          </label>
          <label>
            <span>{{ 'SETTINGS.PROMOS_START_TIME' | translate }}</span>
            <input type="text" [(ngModel)]="draftStartTime" placeholder="HH:MM" />
          </label>
          <label>
            <span>{{ 'SETTINGS.PROMOS_END_TIME' | translate }}</span>
            <input type="text" [(ngModel)]="draftEndTime" placeholder="HH:MM" />
          </label>
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="saving() || !canCreate()"
            (click)="create()"
            data-testid="promo-create"
          >
            {{ saving() ? ('COMMON.SAVING' | translate) : ('SETTINGS.PROMOS_CREATE' | translate) }}
          </button>
          @if (error()) {
            <span class="error">{{ error() }}</span>
          }
          @if (ok()) {
            <span class="ok">{{ 'COMMON.SUCCESS' | translate }}</span>
          }
        </div>

        <h3>{{ 'SETTINGS.PROMOS_LIST' | translate }}</h3>
        @if (promos().length === 0) {
          <p class="hint">{{ 'SETTINGS.PROMOS_EMPTY' | translate }}</p>
        } @else {
          <table class="data-table" data-testid="promo-list">
            <thead>
              <tr>
                <th>{{ 'SETTINGS.PROMOS_NAME' | translate }}</th>
                <th>{{ 'SETTINGS.PROMOS_PERCENT' | translate }}</th>
                <th>{{ 'SETTINGS.PROMOS_CATEGORY' | translate }}</th>
                <th>{{ 'SETTINGS.PROMOS_ENABLED' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of promos(); track p.id) {
                <tr [class.disabled-row]="!p.enabled">
                  <td>{{ p.name }}</td>
                  <td>{{ p.percent_off }}%</td>
                  <td>{{ p.category }}</td>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="p.enabled"
                      (change)="toggleEnabled(p, $event)"
                      [attr.data-testid]="'promo-enabled-' + p.id"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      (click)="disable(p)"
                      data-testid="promo-disable"
                    >
                      {{ 'SETTINGS.PROMOS_DISABLE' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  `,
  styles: [
    `
      .section-header h2 {
        margin: 0 0 0.25rem;
      }
      .section-header p,
      .hint {
        color: var(--text-muted, #666);
        margin: 0 0 1rem;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem 1rem;
        margin-bottom: 1rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
      }
      input,
      select {
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--border, #ccc);
        border-radius: 4px;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }
      .error {
        color: #b00020;
      }
      .ok {
        color: #1b7a3d;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      .data-table th,
      .data-table td {
        text-align: left;
        padding: 0.5rem;
        border-bottom: 1px solid var(--border, #e0e0e0);
      }
      .disabled-row {
        opacity: 0.55;
      }
      .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class PromoSettingsComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  ok = signal(false);
  promos = signal<PricePromotion[]>([]);

  draftName = '';
  draftPercent = 20;
  draftCategory = 'Beverages';
  draftChannels = '';
  draftStartTime = '';
  draftEndTime = '';

  ngOnInit(): void {
    this.reload();
  }

  canCreate(): boolean {
    return !!this.draftName.trim() && !!this.draftCategory.trim() && this.draftPercent >= 1;
  }

  reload(): void {
    this.loading.set(true);
    this.api.listPromos().subscribe({
      next: (rows) => {
        this.promos.set(rows);
        this.loading.set(false);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.error.set(err?.error?.detail || 'Failed to load promos');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (!this.canCreate()) return;
    this.saving.set(true);
    this.error.set(null);
    this.ok.set(false);
    const body: Partial<PricePromotion> & {
      name: string;
      percent_off: number;
      category: string;
    } = {
      name: this.draftName.trim(),
      percent_off: Math.max(1, Math.min(100, Number(this.draftPercent) || 1)),
      category: this.draftCategory.trim(),
      enabled: true,
      stackable: false,
      promo_type: 'percent_off_category',
    };
    if (this.draftChannels) {
      body.channels = [this.draftChannels];
    }
    if (this.draftStartTime.trim()) {
      body.start_time_local = this.draftStartTime.trim();
    }
    if (this.draftEndTime.trim()) {
      body.end_time_local = this.draftEndTime.trim();
    }
    this.api.createPromo(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.ok.set(true);
        this.draftName = '';
        this.reload();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail || 'Create failed');
      },
    });
  }

  toggleEnabled(p: PricePromotion, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.api.updatePromo(p.id, { enabled: checked }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Update failed'),
    });
  }

  disable(p: PricePromotion): void {
    this.api.deletePromo(p.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Disable failed'),
    });
  }
}
