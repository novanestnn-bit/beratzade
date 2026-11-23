import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, LoyaltyMembership, LoyaltyProgram } from '../services/api.service';

@Component({
  selector: 'app-loyalty-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="section" data-testid="settings-loyalty-section">
      <div class="section-header">
        <h2>{{ 'SETTINGS.LOYALTY_TITLE' | translate }}</h2>
        <p>{{ 'SETTINGS.LOYALTY_SUBTITLE' | translate }}</p>
      </div>

      <p class="hint docs">
        <a
          class="docs-link"
          href="https://github.com/novanestnn-bit/beratzade/blob/master/docs/0066-club-loyalty.md"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="settings-loyalty-docs-link"
        >{{ 'SETTINGS.LOYALTY_DOCS_LINK' | translate }}</a>
      </p>

      @if (loading()) {
        <p class="hint">{{ 'COMMON.LOADING' | translate }}</p>
      } @else if (program()) {
        <section class="loyalty-block" aria-labelledby="loyalty-program-heading">
          <h3 id="loyalty-program-heading" class="subsection-title">
            {{ 'SETTINGS.LOYALTY_SECTION_PROGRAM' | translate }}
          </h3>
          <div class="form-grid">
            <label class="check-row">
              <input type="checkbox" [(ngModel)]="enabled" (ngModelChange)="dirty.set(true)" />
              <span>{{ 'SETTINGS.LOYALTY_ENABLED' | translate }}</span>
              <button
                type="button"
                class="field-info-btn"
                [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                [attr.title]="'SETTINGS.LOYALTY_ENABLED_HINT' | translate"
              >
                <span aria-hidden="true">ⓘ</span>
              </button>
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_PROGRAM_NAME' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_PROGRAM_NAME_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input type="text" [(ngModel)]="programName" (ngModelChange)="dirty.set(true)" />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_MODE' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  data-testid="loyalty-mode-help"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_MODE_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <select [(ngModel)]="mode" (ngModelChange)="dirty.set(true)">
                <option value="points">{{ 'SETTINGS.LOYALTY_MODE_POINTS' | translate }}</option>
                <option value="stamps">{{ 'SETTINGS.LOYALTY_MODE_STAMPS' | translate }}</option>
              </select>
              <small class="field-hint">{{ 'SETTINGS.LOYALTY_MODE_HINT' | translate }}</small>
            </label>
          </div>
        </section>

        <section class="loyalty-block" aria-labelledby="loyalty-earn-heading">
          <h3 id="loyalty-earn-heading" class="subsection-title">
            {{ 'SETTINGS.LOYALTY_SECTION_EARN_REDEEM' | translate }}
          </h3>
          <div class="form-grid">
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_EARN' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_EARN_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input type="number" min="0" [(ngModel)]="earnUnits" (ngModelChange)="dirty.set(true)" />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_THRESHOLD' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_THRESHOLD_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="1"
                [(ngModel)]="threshold"
                (ngModelChange)="dirty.set(true)"
              />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_REWARD_CENTS' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_REWARD_CENTS_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="rewardCents"
                (ngModelChange)="dirty.set(true)"
              />
            </label>
          </div>
        </section>

        <section class="loyalty-block" aria-labelledby="loyalty-extras-heading">
          <h3 id="loyalty-extras-heading" class="subsection-title">
            {{ 'SETTINGS.LOYALTY_SECTION_EXTRAS' | translate }}
          </h3>
          <div class="form-grid">
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_BIRTHDAY_BONUS' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_BIRTHDAY_BONUS_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="birthdayBonus"
                (ngModelChange)="dirty.set(true)"
                data-testid="loyalty-birthday-bonus"
              />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_VIP_SILVER' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_VIP_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="vipSilver"
                (ngModelChange)="dirty.set(true)"
                data-testid="loyalty-vip-silver"
              />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_VIP_GOLD' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_VIP_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="vipGold"
                (ngModelChange)="dirty.set(true)"
                data-testid="loyalty-vip-gold"
              />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_REFERRAL_BONUS' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_REFERRAL_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="referralBonus"
                (ngModelChange)="dirty.set(true)"
                data-testid="loyalty-referral-bonus"
              />
            </label>
            <label>
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_REFERRAL_INVITEE' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_REFERRAL_INVITEE_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <input
                type="number"
                min="0"
                [(ngModel)]="referralInvitee"
                (ngModelChange)="dirty.set(true)"
                data-testid="loyalty-referral-invitee"
              />
            </label>
          </div>
        </section>

        <section class="loyalty-block" aria-labelledby="loyalty-public-heading">
          <h3 id="loyalty-public-heading" class="subsection-title">
            {{ 'SETTINGS.LOYALTY_SECTION_PUBLIC' | translate }}
          </h3>
          @if (joinUrl()) {
            <p class="join-url" data-testid="loyalty-join-url">
              <span class="label-row">
                {{ 'SETTINGS.LOYALTY_JOIN_URL' | translate }}
                <button
                  type="button"
                  class="field-info-btn"
                  [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                  [attr.title]="'SETTINGS.LOYALTY_JOIN_URL_HINT' | translate"
                >
                  <span aria-hidden="true">ⓘ</span>
                </button>
              </span>
              <code>{{ joinUrl() }}</code>
            </p>
          }
          <label class="check">
            <input
              type="checkbox"
              [(ngModel)]="walletPassesEnabled"
              (ngModelChange)="dirty.set(true)"
              data-testid="loyalty-wallet-passes-enabled"
            />
            <span class="label-row">
              <span>{{ 'SETTINGS.LOYALTY_WALLET_ENABLED' | translate }}</span>
              <button
                type="button"
                class="field-info-btn"
                [attr.aria-label]="'SETTINGS.LOYALTY_FIELD_HELP' | translate"
                [attr.title]="'SETTINGS.LOYALTY_WALLET_ENABLED_HINT' | translate"
              >
                <span aria-hidden="true">ⓘ</span>
              </button>
            </span>
          </label>
          @if (walletDetail()) {
            <p class="hint wallet-note">{{ walletDetail() }}</p>
          } @else {
            <p class="hint wallet-note">{{ 'SETTINGS.LOYALTY_WALLET_NOTE' | translate }}</p>
          }
        </section>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="!dirty() || saving()"
            (click)="save()"
            data-testid="loyalty-save"
          >
            {{ saving() ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
          </button>
          @if (saveError()) {
            <span class="error">{{ saveError() }}</span>
          }
          @if (saveOk()) {
            <span class="ok">{{ 'COMMON.SUCCESS' | translate }}</span>
          }
        </div>

        <section class="loyalty-block members-block" aria-labelledby="loyalty-members-heading">
          <h3 id="loyalty-members-heading" class="subsection-title">
            {{ 'SETTINGS.LOYALTY_MEMBERS' | translate }}
          </h3>
          @if (members().length === 0 && !memberSearch.trim()) {
            <div class="members-empty" data-testid="loyalty-members-empty">
              <span class="members-empty-icon" aria-hidden="true">◎</span>
              <p>{{ 'SETTINGS.LOYALTY_MEMBERS_EMPTY' | translate }}</p>
              <p class="hint">{{ 'SETTINGS.LOYALTY_MEMBERS_EMPTY_HINT' | translate }}</p>
              @if (joinUrl()) {
                <code class="members-empty-url">{{ joinUrl() }}</code>
              }
            </div>
          } @else {
            <label class="members-search">
              <span>{{ 'SETTINGS.LOYALTY_MEMBERS_SEARCH' | translate }}</span>
              <input
                type="search"
                [(ngModel)]="memberSearch"
                (ngModelChange)="onMemberSearch($event)"
                name="loyaltyMemberSearch"
                data-testid="loyalty-members-search"
                [placeholder]="'SETTINGS.LOYALTY_MEMBERS_SEARCH_HINT' | translate"
              />
            </label>
            @if (members().length === 0) {
              <p class="hint" data-testid="loyalty-members-search-empty">
                {{ 'SETTINGS.LOYALTY_MEMBERS_SEARCH_EMPTY' | translate }}
              </p>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>{{ 'COMMON.NAME' | translate }}</th>
                      <th>{{ 'COMMON.EMAIL' | translate }}</th>
                      <th>{{ 'SETTINGS.LOYALTY_BALANCE' | translate }}</th>
                      <th>{{ 'SETTINGS.LOYALTY_VIP_TIER' | translate }}</th>
                      <th>{{ 'SETTINGS.LOYALTY_REFERRAL_CODE' | translate }}</th>
                      <th>{{ 'SETTINGS.LOYALTY_CARD_LINK' | translate }}</th>
                      <th>{{ 'COMMON.ACTIONS' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of members(); track m.id) {
                      <tr>
                        <td>{{ m.display_name }}</td>
                        <td>{{ m.email || m.phone || '—' }}</td>
                        <td>{{ m.balance }}</td>
                        <td data-testid="loyalty-member-tier">{{ tierLabel(m.vip_tier) }}</td>
                        <td>
                          <code>{{ m.referral_code || '—' }}</code>
                        </td>
                        <td>
                          @if (m.member_token) {
                            <button
                              type="button"
                              class="btn btn-secondary btn-sm"
                              data-testid="loyalty-copy-card-link"
                              (click)="copyCardLink(m.member_token)"
                            >
                              {{
                                copiedToken() === m.member_token
                                  ? ('SETTINGS.LOYALTY_COPIED' | translate)
                                  : ('SETTINGS.LOYALTY_COPY_CARD' | translate)
                              }}
                            </button>
                          } @else {
                            —
                          }
                        </td>
                        <td>
                          <button
                            type="button"
                            class="btn btn-secondary btn-sm btn-danger"
                            data-testid="loyalty-delete-member"
                            [disabled]="deletingId() === m.id"
                            (click)="confirmDeleteMember(m)"
                          >
                            {{
                              deletingId() === m.id
                                ? ('COMMON.SAVING' | translate)
                                : ('COMMON.DELETE' | translate)
                            }}
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </section>
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
        color: var(--text-muted, var(--color-text-muted, #666));
        margin: 0 0 1rem;
      }
      .docs-link {
        color: #0369a1;
        font-weight: 600;
        text-decoration: underline;
      }
      .docs-link:hover {
        color: #0c4a6e;
      }
      .loyalty-block {
        margin-bottom: 0.5rem;
      }
      .subsection-title {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 1rem 0 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border, var(--color-border, #ddd));
      }
      .loyalty-block:first-of-type .subsection-title {
        margin-top: 0;
        padding-top: 0;
        border-top: none;
      }
      .form-grid {
        display: grid;
        gap: 0.75rem 1rem;
        max-width: 36rem;
        margin-bottom: 0.5rem;
      }
      @media (min-width: 640px) {
        .form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .form-grid .check-row {
          grid-column: 1 / -1;
        }
      }
      .form-grid label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
      }
      .label-row {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .check-row {
        flex-direction: row !important;
        align-items: center;
        gap: 0.5rem !important;
      }
      .field-info-btn {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted, var(--color-text-muted, #666));
        font-size: 0.875rem;
        line-height: 1;
        cursor: help;
      }
      .field-info-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-primary-light, #93c5fd);
      }
      .field-hint {
        color: var(--text-muted, var(--color-text-muted, #666));
        font-size: 0.8125rem;
        line-height: 1.35;
      }
      input,
      select {
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--border, var(--color-border, #ccc));
        border-radius: 4px;
        min-height: 2.5rem;
        font: inherit;
      }
      .join-url {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
      }
      .join-url code,
      .members-empty-url {
        word-break: break-all;
        font-size: 0.8125rem;
        padding: 0.35rem 0.5rem;
        background: var(--color-bg, #f6f6f6);
        border-radius: 4px;
      }
      .wallet-note {
        margin-bottom: 0.5rem;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin: 1.25rem 0 0.5rem;
      }
      .error {
        color: #b00020;
      }
      .ok {
        color: #0a7a2f;
      }
      .members-block .subsection-title {
        margin-top: 1.25rem;
      }
      .members-empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.35rem;
        max-width: 36rem;
        margin-bottom: 1rem;
      }
      .members-empty p {
        margin: 0;
      }
      .members-empty .hint {
        margin: 0;
      }
      .members-empty-icon {
        font-size: 1.5rem;
        line-height: 1;
        color: var(--text-muted, var(--color-text-muted, #666));
      }
      .table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 28rem;
      }
      .data-table th,
      .data-table td {
        text-align: left;
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--border, var(--color-border, #ddd));
      }
      .members-search {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        max-width: 24rem;
        margin-bottom: 0.75rem;
        font-size: 0.9rem;
      }
      .members-search input {
        padding: 0.4rem 0.5rem;
      }
      .btn-sm {
        font-size: 0.8rem;
        padding: 0.25rem 0.5rem;
      }
      .btn-danger {
        color: #b00020;
        border-color: #f1c0c0;
      }
      .btn-danger:hover:not(:disabled) {
        background: #fef2f2;
      }
    `,
  ],
})
export class LoyaltySettingsComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  loading = signal(true);
  saving = signal(false);
  dirty = signal(false);
  saveError = signal('');
  saveOk = signal(false);
  program = signal<LoyaltyProgram | null>(null);
  members = signal<LoyaltyMembership[]>([]);
  joinUrl = signal('');
  walletDetail = signal('');
  memberSearch = '';
  copiedToken = signal<string | null>(null);
  deletingId = signal<number | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  enabled = false;
  programName = 'Club';
  mode: 'points' | 'stamps' = 'points';
  earnUnits = 1;
  threshold = 10;
  rewardCents = 500;
  birthdayBonus = 0;
  vipSilver = 0;
  vipGold = 0;
  referralBonus = 0;
  referralInvitee = 0;
  walletPassesEnabled = true;

  ngOnInit(): void {
    this.reload();
  }

  tierLabel(tier: string | null | undefined): string {
    if (tier === 'gold') return 'Gold';
    if (tier === 'silver') return 'Silver';
    return '—';
  }

  cardUrl(token: string): string {
    if (typeof window === 'undefined') return `/loyalty/card/${token}`;
    return `${window.location.origin}/loyalty/card/${token}`;
  }

  copyCardLink(token: string): void {
    const url = this.cardUrl(token);
    const done = () => {
      this.copiedToken.set(token);
      setTimeout(() => {
        if (this.copiedToken() === token) this.copiedToken.set(null);
      }, 2000);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => done());
    } else {
      done();
    }
  }

  confirmDeleteMember(member: LoyaltyMembership): void {
    if (!member?.id || this.deletingId() != null) return;
    const name = member.display_name || member.email || member.phone || String(member.id);
    const msg = this.translate.instant('SETTINGS.LOYALTY_CONFIRM_DELETE_MEMBER', { name });
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    this.deletingId.set(member.id);
    this.saveError.set('');
    this.api.deleteLoyaltyMembership(member.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadMembers();
      },
      error: (err) => {
        this.deletingId.set(null);
        this.saveError.set(err?.error?.detail || 'Delete failed');
      },
    });
  }

  onMemberSearch(value: string): void {
    this.memberSearch = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadMembers(), 250);
  }

  loadMembers(): void {
    this.api.listLoyaltyMemberships(this.memberSearch || undefined).subscribe({
      next: (rows) => this.members.set(rows || []),
      error: () => this.members.set([]),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.api.getLoyaltyProgram().subscribe({
      next: (p) => {
        this.program.set(p);
        this.enabled = !!p.enabled;
        this.programName = p.program_name || 'Club';
        this.mode = p.mode === 'stamps' ? 'stamps' : 'points';
        this.earnUnits = p.earn_units_per_order;
        this.threshold = p.redemption_threshold;
        this.rewardCents = p.reward_discount_cents;
        this.birthdayBonus = p.birthday_bonus_units ?? 0;
        this.vipSilver = p.vip_silver_min_lifetime_units ?? 0;
        this.vipGold = p.vip_gold_min_lifetime_units ?? 0;
        this.referralBonus = p.referral_bonus_units ?? 0;
        this.referralInvitee = p.referral_invitee_bonus_units ?? 0;
        this.walletPassesEnabled = p.wallet_passes_enabled !== false;
        this.joinUrl.set(
          typeof window !== 'undefined' && p.join_path
            ? `${window.location.origin}${p.join_path}`
            : p.join_path || '',
        );
        this.walletDetail.set(p.wallet?.detail || '');
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.saveError.set('Failed to load loyalty program');
      },
    });
    this.loadMembers();
  }

  save(): void {
    this.saving.set(true);
    this.saveError.set('');
    this.saveOk.set(false);
    this.api
      .updateLoyaltyProgram({
        enabled: this.enabled,
        program_name: this.programName,
        mode: this.mode,
        earn_units_per_order: Number(this.earnUnits) || 0,
        redemption_threshold: Math.max(1, Number(this.threshold) || 1),
        reward_discount_cents: Math.max(0, Number(this.rewardCents) || 0),
        birthday_bonus_units: Math.max(0, Number(this.birthdayBonus) || 0),
        vip_silver_min_lifetime_units: Math.max(0, Number(this.vipSilver) || 0),
        vip_gold_min_lifetime_units: Math.max(0, Number(this.vipGold) || 0),
        referral_bonus_units: Math.max(0, Number(this.referralBonus) || 0),
        referral_invitee_bonus_units: Math.max(0, Number(this.referralInvitee) || 0),
        wallet_passes_enabled: this.walletPassesEnabled,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saveOk.set(true);
          this.reload();
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(err?.error?.detail || 'Save failed');
        },
      });
  }
}
