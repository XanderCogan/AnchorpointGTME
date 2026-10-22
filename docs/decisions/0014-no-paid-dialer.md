# Decision 0014: No Paid Dialer; the Call Handoff Ends at an Attio List

Status: approved on 2026-10-22.

Date: 2026-10-22  
Decision owner: User  
AI role: priced TitanX alternatives and drafted the record

## Question

TitanX needs a costly subscription. Nooks was proposed as a cheaper alternative. Which dialer should Milestone 7 connect to?

## Decision

None. No dialer subscription is bought. Milestone 7 builds and proves the controlled Attio List of approved phone-ready contacts, which is the point where any dialer would load its queue. TitanX stays named as the planned calling system, but nothing connects to it.

Nooks was rejected on price: it publishes no list price, and third-party estimates put it at about $4,000 to $5,000 per seat per year on annual terms with a two- to five-seat minimum (MarketBetter, Artisan, and Dupple, retrieved 2026-10-22). Allo, about $45 per user per month by one review, installs a power dialer inside Attio that reads Attio Lists (withallo.com, retrieved 2026-10-22). It is the fallback if a connected dialer is wanted later; its price and trial terms were not confirmed with the vendor.

## Consequences

- Because no call is ever placed (decision 0012), a dialer would add cost without changing what the system proves.
- Dispositions cannot come from a real dialer, so the Milestone 7 disposition mapping is proven on fixtures only.
- Any later dialer reads the same Attio List; the application's eligibility, approval, and suppression rules do not change.
