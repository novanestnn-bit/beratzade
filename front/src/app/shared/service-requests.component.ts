import { Component, OnDestroy, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, ServiceRequest } from '../services/api.service';

@Component({
  selector: 'app-service-requests', standalone: true, imports: [TranslateModule],
  template: `
    @if (allowed) {
      <section class="requests" data-testid="service-requests">
        <h2>{{ 'SERVICE_REQUESTS.TITLE' | translate }} ({{ requests().length }})</h2>
        @if (unavailable()) { <p role="status" data-testid="service-requests-offline">{{ 'SERVICE_REQUESTS.OFFLINE' | translate }}</p> }
        @for (request of requests(); track request.id) {
          <article [attr.data-testid]="'service-request-' + request.id">
            <strong>{{ request.table_name }} · {{ ('SERVICE_REQUESTS.' + (request.kind === 'call_waiter' ? 'WAITER' : 'PAYMENT')) | translate }}</strong>
            <span>{{ request.message }}</span>
            <span>{{ ('SERVICE_REQUESTS.' + request.status.toUpperCase()) | translate }}</span>
            @if (request.status === 'pending') {
              <button type="button" [disabled]="updating() === request.id" (click)="change(request, 'acknowledged')" data-testid="request-acknowledge">{{ 'SERVICE_REQUESTS.ACK' | translate }}</button>
            }
            <button type="button" [disabled]="updating() === request.id" (click)="change(request, 'resolved')" data-testid="request-resolve">{{ 'SERVICE_REQUESTS.RESOLVE' | translate }}</button>
          </article>
        }
      </section>
    }
  `,
  styles: [`.requests{padding:.75rem;border:1px solid #d5c5ad;border-radius:.75rem;margin:.5rem 0;background:#fffaf0;color:#332b20}.requests h2{font-size:1rem;margin:0 0 .5rem}article{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap;padding:.5rem;border-top:1px solid #ddd}button{padding:.4rem .65rem;cursor:pointer}`],
})
export class ServiceRequestsComponent implements OnDestroy {
  private api = inject(ApiService);
  readonly allowed = ['owner', 'admin', 'waiter'].includes(this.api.getCurrentUser()?.role || '');
  readonly requests = signal<ServiceRequest[]>([]);
  readonly unavailable = signal(false);
  readonly updating = signal<number | null>(null);
  private busy = false;
  private destroyed = false;
  private timer: ReturnType<typeof setInterval>;
  constructor() {
    this.reload();
    this.timer = setInterval(() => this.reload(), 5000);
  }
  reload() {
    if (!this.allowed || this.busy || this.destroyed) return;
    this.busy = true;
    this.api.getServiceRequests().subscribe({ next: rows => { if (!this.destroyed) { this.requests.set(rows); this.unavailable.set(false); } this.busy = false; }, error: () => { this.busy = false; this.unavailable.set(true); } });
  }
  change(request: ServiceRequest, status: 'acknowledged' | 'resolved') {
    this.updating.set(request.id);
    this.api.updateServiceRequest(request.id, status).subscribe({ next: () => { this.updating.set(null); this.reload(); }, error: () => { this.updating.set(null); this.unavailable.set(true); this.reload(); } });
  }
  ngOnDestroy() { this.destroyed = true; clearInterval(this.timer); }
}
