# Arbati ERP - Scalability Roadmap

This document outlines the evolution path for Arbati from a monolith to a scalable microservices architecture.

## Current Architecture: Monolith

**Phase 1: Next.js Monolith (Current)**

- Single Next.js application
- PostgreSQL database
- Clear domain boundaries within monolith
- Single deployment

**Benefits:**
- Simple deployment
- Easy development
- Low operational overhead
- Fast iteration

**Limitations:**
- Single point of failure
- Limited horizontal scaling
- All features scale together

---

## Phase 2: Service Separation

**Target**: Separate frontend and backend services

### Architecture

```
┌─────────────┐
│   Frontend  │  Next.js (SSR/Static)
│  (Next.js)  │
└──────┬──────┘
       │ HTTP/REST
       │
┌──────▼──────┐
│  API Service│  Node.js/Express or NestJS
│  (Backend)  │
└──────┬──────┘
       │
┌──────▼──────┐
│  PostgreSQL │
└─────────────┘
```

### Changes Required

1. **Extract API Layer**
   - Move Server Actions → REST API endpoints
   - Move Route Handlers → API service routes
   - Keep domain layer shared (monorepo)

2. **Frontend Changes**
   - Use API routes instead of Server Actions
   - Add API client library (axios/fetch wrapper)
   - Handle authentication via JWT tokens

3. **Shared Code**
   - Use monorepo (Turborepo/Nx) for shared domain layer
   - Share TypeScript types via packages
   - Shared validation schemas (Zod)

### Implementation Steps

1. Create `api-service/` directory
2. Extract API endpoints from Next.js Route Handlers
3. Create API client in frontend
4. Replace Server Actions with API calls
5. Deploy separately (frontend + API service)

---

## Phase 3: Microservices Architecture

**Target**: Domain-driven microservices

### Architecture

```
┌─────────────┐
│   Frontend  │  Next.js (SSR/Static)
│  (Next.js)  │
└──────┬──────┘
       │
┌──────▼──────────────────────────────┐
│        API Gateway                  │
│    (Kong, Traefik, or custom)      │
└──┬────┬────┬────┬────┬────┬────────┘
   │    │    │    │    │    │
   │    │    │    │    │    │
┌──▼─┐┌─▼─┐┌─▼─┐┌─▼─┐┌─▼─┐┌─▼─┐
│Prod││Sal││Inv││Cust││Auth││Rpt│  Microservices
│ Svc││Svc││Svc││Svc ││Svc ││Svc│
└──┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘
   │    │    │    │    │    │
┌──▼────▼────▼────▼────▼────▼──┐
│   Event Bus (Kafka/RabbitMQ)  │
└───────────────────────────────┘
   │    │    │    │    │    │
┌──▼─┐┌─▼─┐┌─▼─┐┌─▼─┐┌─▼─┐┌─▼─┐
│ DB ││DB ││DB ││DB ││DB ││DB │  Databases
└────┘└───┘└───┘└───┘└───┘└───┘
```

### Microservices Breakdown

1. **Products Service**
   - Products, Categories, Stock management
   - Database: Products DB
   - APIs: CRUD products, stock updates

2. **Sales Service**
   - Sales, Drafts, SaleItems
   - Database: Sales DB
   - APIs: Create sale, manage drafts

3. **Invoices Service**
   - Invoices, InvoiceItems
   - Database: Invoices DB
   - APIs: Generate invoices, PDF generation

4. **Customers Service**
   - Customers, CustomerBalance
   - Database: Customers DB
   - APIs: CRUD customers, balance updates

5. **Auth Service**
   - Users, Roles, Permissions
   - Database: Auth DB
   - APIs: Login, signup, token refresh

6. **Reports Service**
   - Analytics, Reports generation
   - Database: Analytics DB (read replicas)
   - APIs: Generate reports, dashboards

### Communication Patterns

1. **Synchronous**: REST APIs for real-time operations
2. **Asynchronous**: Event bus for:
   - Stock updates → Products Service
   - Balance updates → Customers Service
   - Invoice creation → Reports Service

### Event Examples

```typescript
// Event: Sale Created
{
  event: 'sale.created',
  data: {
    saleId: '...',
    customerId: '...',
    total: 1000,
    items: [...]
  }
}

// Event: Stock Updated
{
  event: 'stock.updated',
  data: {
    productId: '...',
    quantity: -5,
    reason: 'sale'
  }
}
```

---

## Phase 4: Advanced Features

### Multi-Warehouse Support

**Requirements:**
- Stock per warehouse
- Inter-warehouse transfers
- Location-based inventory

**Implementation:**
- Add `warehouseId` to StockMovement
- Create Warehouse service or extend Products service
- Implement transfer APIs

### Real-Time Inventory Sync

**Requirements:**
- Real-time stock updates across services
- WebSocket connections
- Optimistic UI updates

**Implementation:**
- WebSocket server (Socket.io)
- Event streaming (Kafka)
- Client-side subscriptions

### Advanced Reporting

**Requirements:**
- Complex analytics
- Custom report builder
- Export (PDF, Excel, CSV)

**Implementation:**
- Dedicated Reports service
- Data warehouse (OLAP)
- Report generation engine (Puppeteer for PDFs)

### Accounting Integration

**Requirements:**
- Journal entries export
- GL integration
- Financial reports

**Implementation:**
- Accounting service
- Export format (Xero, QuickBooks, custom)
- Scheduled sync jobs

### Mobile App

**Requirements:**
- React Native app
- Offline support
- Sync on reconnect

**Implementation:**
- Shared API with web
- Local database (SQLite)
- Sync mechanism

### Third-Party Integrations

**Payment Gateways:**
- Stripe, PayPal integration
- Payment service abstraction

**Shipping:**
- Shipping provider APIs
- Tracking integration

**Email/SMS:**
- Email service (SendGrid, SES)
- SMS service (Twilio)

---

## Scalability Strategies

### Database Scaling

1. **Read Replicas**
   - Primary for writes
   - Replicas for reads
   - Connection pooling

2. **Partitioning**
   - Partition large tables by date
   - Horizontal sharding by region

3. **Caching**
   - Redis for frequently accessed data
   - Cache invalidation strategy

4. **Search Optimization**
   - Full-text search (PostgreSQL, Elasticsearch)
   - Index optimization

### API Scaling

1. **Horizontal Scaling**
   - Multiple API instances
   - Load balancer (NGINX, AWS ALB)

2. **Caching**
   - API response caching
   - CDN for static assets

3. **Rate Limiting**
   - Per-user rate limits
   - Per-IP rate limits

4. **Database Connection Pooling**
   - pgBouncer
   - Connection pool per service

### Background Jobs

1. **Job Queue**
   - Bull/BullMQ (Redis-based)
   - Separate worker processes

2. **Scheduled Jobs**
   - Low-stock alerts (daily)
   - Report generation (nightly)
   - Data cleanup (weekly)

### Monitoring & Observability

1. **APM**
   - Application Performance Monitoring
   - Error tracking (Sentry)
   - Metrics (Prometheus, Datadog)

2. **Logging**
   - Centralized logging (ELK, Loki)
   - Structured logging
   - Log aggregation

3. **Alerting**
   - Error rate alerts
   - Performance degradation alerts
   - Low-stock alerts

---

## Migration Strategy

### Phase 1 → Phase 2

1. Extract API routes to separate service
2. Deploy API service alongside Next.js
3. Update frontend to use API
4. Monitor performance
5. Gradually migrate traffic

### Phase 2 → Phase 3

1. Identify service boundaries (by domain)
2. Extract first service (e.g., Products)
3. Implement event bus
4. Migrate service data
5. Update API Gateway
6. Repeat for each service

### Data Migration

- Use database replication
- Dual-write during migration
- Validate data consistency
- Switch reads to new service
- Stop writes to old service
- Clean up old data

---

## Technology Recommendations

### Container Orchestration
- **Kubernetes**: For microservices
- **Docker Swarm**: Simpler alternative

### Service Mesh
- **Istio**: Advanced traffic management
- **Linkerd**: Lightweight alternative

### API Gateway
- **Kong**: Feature-rich
- **Traefik**: Simple, auto-discovery
- **AWS API Gateway**: If on AWS

### Event Streaming
- **Apache Kafka**: High throughput
- **RabbitMQ**: Simpler, good for smaller scale
- **Redis Streams**: Lightweight

### Monitoring
- **Prometheus + Grafana**: Metrics
- **ELK Stack**: Logging
- **Jaeger**: Distributed tracing

### Database
- **PostgreSQL**: Continue using (scales well)
- **Redis**: Caching, sessions, job queues
- **Elasticsearch**: Search, analytics

---

## Performance Targets

### Current (Monolith)
- **Response Time**: < 500ms (p95)
- **Throughput**: 100 req/s
- **Concurrent Users**: 50

### Phase 2 (Separated Services)
- **Response Time**: < 300ms (p95)
- **Throughput**: 500 req/s
- **Concurrent Users**: 250

### Phase 3 (Microservices)
- **Response Time**: < 200ms (p95)
- **Throughput**: 2000+ req/s
- **Concurrent Users**: 1000+

---

## Cost Considerations

### Monolith
- **Low**: Single server, single database

### Separated Services
- **Medium**: 2-3 servers, database replication

### Microservices
- **High**: Multiple services, databases, infrastructure

**Recommendation**: Start with monolith, scale when needed. Premature optimization is expensive.

---

## Conclusion

Arbati is designed to evolve. The current architecture:

✅ Supports current needs  
✅ Allows future scaling  
✅ Maintains clean boundaries  
✅ Enables gradual migration  

**Key Principle**: Scale when you need to, not before.

