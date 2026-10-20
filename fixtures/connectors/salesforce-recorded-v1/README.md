# Salesforce Recorded Responses v1

SYNTHETIC. Every file here is hand-written to match the documented shape of the Salesforce REST query resource (`totalSize`, `done`, `nextRecordsUrl`, `records` with `attributes`). Nothing was recorded from a real org. All names are fictional and marked "(fixture)" or "Synthetic", IDs use an `SYN` infix, and every domain is a reserved `.example` domain. These files are connector test inputs, not market evidence or customer history.

Page sizes are deliberately tiny so pagination is exercised with a handful of records. Real Salesforce pages hold 200 to 2,000 records.

## Scenarios

- `initial/` answers the first bounded window for all eight mirrored objects: User, Account, `Site__c`, Contact, Lead, Campaign, Opportunity, and Task. Account, Contact, and Task each span two pages linked by `nextRecordsUrl`. One Account has a `SystemModstamp` later than its `LastModifiedDate`, and one sits exactly on the window's upper bound.
- `incremental/` answers the next window. It returns the boundary Account again unchanged, one renamed Account with a newer `SystemModstamp`, and empty results for every other object.

`Site__c` and its `Account__c` field are provisional until the custom object exists in the Developer Edition org.

Do not edit these files in place once tests depend on them. Add a new scenario or a `salesforce-recorded-v2` directory instead.
