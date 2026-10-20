# Synthetic Fixtures

All records in this directory are fictional and use reserved `.example` domains. They must never be presented as customer data or real commercial outcomes.

## Releases

`inspection-v1` is the first immutable HubSpot-shaped CRM audit release. Its input contains owners, companies, contacts, deals, activities, and tasks. Its expected directory contains findings and control totals authored independently from the audit implementation.

Do not edit an approved release in place. Create a new release when adding or changing scenarios so historical inspection evidence remains reproducible.

Generated findings belong under `artifacts/` and are not source fixtures.


## Connector recordings

`connectors/salesforce-recorded-v1` holds hand-written, synthetic Salesforce REST query responses for the Milestone 3 read-only connector tests. They follow the same rules: fictional, reserved domains, and never edited in place once tests depend on them.
