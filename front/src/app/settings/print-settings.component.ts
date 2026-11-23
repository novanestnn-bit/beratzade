import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, PrintAgent, PrintBridgeStatus } from '../services/api.service';

@Component({
  selector: 'app-print-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="section" data-testid="settings-printing-section">
      <div class="section-header">
        <h2>{{ 'SETTINGS.PRINTING_TITLE' | translate }}</h2>
        <p>{{ 'SETTINGS.PRINTING_SUBTITLE' | translate }}</p>
      </div>

      @if (status()) {
        <p
          class="bridge-status"
          [class.online]="status()!.agent_online"
          [class.offline]="!status()!.agent_online"
          data-testid="print-bridge-status"
        >
          {{
            status()!.agent_online
              ? ('SETTINGS.PRINTING_BRIDGE_ONLINE' | translate)
              : ('SETTINGS.PRINTING_BRIDGE_OFFLINE' | translate)
          }}
          @if (status()!.last_seen_at) {
            <span class="hint"> · {{ status()!.last_seen_at }}</span>
          }
        </p>
      }

      <div class="form-grid">
        <label>
          <span>{{ 'SETTINGS.PRINTING_DEVICE_ID' | translate }}</span>
          <input
            type="text"
            [(ngModel)]="deviceId"
            data-testid="print-agent-device-id"
            placeholder="kitchen-pi-1"
          />
        </label>
        <label>
          <span>{{ 'SETTINGS.PRINTING_DISPLAY_NAME' | translate }}</span>
          <input type="text" [(ngModel)]="displayName" data-testid="print-agent-display-name" />
        </label>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!deviceId.trim() || creating()"
          (click)="createAgent()"
          data-testid="print-agent-create"
        >
          {{ 'SETTINGS.PRINTING_CREATE_AGENT' | translate }}
        </button>
        <button type="button" class="btn btn-secondary" (click)="reload()" [disabled]="loading()">
          {{ 'SETTINGS.PRINTING_REFRESH' | translate }}
        </button>
      </div>

      @if (newToken()) {
        <div class="token-box" data-testid="print-agent-token-once">
          <p>{{ 'SETTINGS.PRINTING_TOKEN_ONCE' | translate }}</p>
          <code>{{ newToken() }}</code>
        </div>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <h3>{{ 'SETTINGS.PRINTING_AGENTS' | translate }}</h3>
      @if (loading()) {
        <p class="hint">{{ 'COMMON.LOADING' | translate }}</p>
      } @else if (!agents().length) {
        <p class="hint">{{ 'SETTINGS.PRINTING_AGENTS_EMPTY' | translate }}</p>
      } @else {
        <ul class="agent-list">
          @for (a of agents(); track a.id) {
            <li [attr.data-testid]="'print-agent-' + a.id">
              <strong>{{ a.display_name }}</strong>
              <span class="hint"> ({{ a.device_id }})</span>
              <span [class.online]="a.online && !a.revoked_at" [class.offline]="!a.online || !!a.revoked_at">
                {{
                  a.revoked_at
                    ? ('SETTINGS.PRINTING_REVOKED' | translate)
                    : a.online
                      ? ('SETTINGS.PRINTING_ONLINE' | translate)
                      : ('SETTINGS.PRINTING_OFFLINE' | translate)
                }}
              </span>
              @if (!a.revoked_at) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="revoke(a)">
                  {{ 'SETTINGS.PRINTING_REVOKE' | translate }}
                </button>
              }
            </li>
          }
        </ul>
      }

      <p class="hint docs">
        <a
          class="docs-link"
          href="https://github.com/novanestnn-bit/beratzade/blob/master/docs/0070-hardware-printing.md"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="settings-printing-docs-link"
        >{{ 'SETTINGS.PRINTING_DOCS_LINK' | translate }}</a>
        <span> — {{ 'SETTINGS.PRINTING_AGENT_CMD_HINT' | translate }}</span>
      </p>
    </div>
  `,
  styles: [
    `
      .section-header h2 {
        margin: 0 0 0.25rem;
      }
      .section-header p,
      .hint {
        color: #64748b;
        font-size: 0.9rem;
      }
      .docs-link {
        color: #0369a1;
        font-weight: 600;
        text-decoration: underline;
      }
      .docs-link:hover {
        color: #0c4a6e;
      }
      .form-grid {
        display: grid;
        gap: 0.75rem;
        max-width: 28rem;
        margin: 1rem 0;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.85rem;
      }
      input {
        padding: 0.5rem 0.65rem;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .bridge-status.online,
      .online {
        color: #15803d;
      }
      .bridge-status.offline,
      .offline {
        color: #b45309;
      }
      .token-box {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 1rem;
        word-break: break-all;
      }
      .agent-list {
        list-style: none;
        padding: 0;
        margin: 0 0 1rem;
      }
      .agent-list li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
      }
      .error {
        color: #b91c1c;
      }
      .docs {
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class PrintSettingsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly agents = signal<PrintAgent[]>([]);
  readonly status = signal<PrintBridgeStatus | null>(null);
  readonly newToken = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  deviceId = '';
  displayName = 'Print agent';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listPrintAgents().subscribe({
      next: (rows) => {
        this.agents.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'Failed to load agents');
        this.loading.set(false);
      },
    });
    this.api.getPrintBridgeStatus().subscribe({
      next: (s) => this.status.set(s),
      error: () => this.status.set(null),
    });
  }

  createAgent(): void {
    const device_id = this.deviceId.trim();
    if (!device_id) return;
    this.creating.set(true);
    this.error.set(null);
    this.api
      .createPrintAgent({
        device_id,
        display_name: this.displayName.trim() || 'Print agent',
      })
      .subscribe({
        next: (a) => {
          this.newToken.set(a.token ?? null);
          this.deviceId = '';
          this.creating.set(false);
          this.reload();
        },
        error: (err) => {
          this.error.set(err?.error?.detail ?? 'Failed to create agent');
          this.creating.set(false);
        },
      });
  }

  revoke(a: PrintAgent): void {
    this.api.revokePrintAgent(a.id).subscribe({
      next: () => this.reload(),
      error: (err) => this.error.set(err?.error?.detail ?? 'Failed to revoke'),
    });
  }
}
