# Apero Portfolio Context

Last reviewed: 2026-10-20

## Purpose

Portco Launch Control is a work sample for a GTM engineering role at Apero Advisors. It should make the case through inspectable work: real market data, explicit qualification logic, a working CRM load, written copy with its reasoning, and short videos that walk through all of it.

## The opening

Apero has a live GTM engineering opening. Apero's Head of GTM, Benyamin Holley, announced it in a public post around 2026-10-17, saying Apero had signed several large clients and needed another person doing fulfillment. Source: the user's copy of the post, recorded 2026-10-20. This replaces the 2026-10-18 finding that no public opening existed.

The post lists these required skills:

- Cursor
- Clay
- basic software engineering
- HubSpot or Salesforce
- EmailBison, Lemlist, or another sequencer
- Vercel
- implementing dialers such as Nooks and TitanX
- a working sense of what makes a sales team's life easier

The post says Apero hires globally and is targeting LATAM, Pakistan, India, and some European countries, where it can pay well relative to local cost. Candidates elsewhere are not excluded, but this is a real constraint on positioning.

## What the hiring manager says he wants

In a follow-up public post (same source and recording date), the Head of GTM said applicants need a portfolio and listed what helps:

- a GitHub repository he can look at, even if it is vibe coded
- JSON artifacts
- Mermaid charts explaining CRM logic
- Loom videos
- copy examples together with the process behind them
- system schemas, such as a CRM instance design he could discuss with an AI assistant

He said these do not help: AI-generated landing pages that list skills without proof, writing with obvious AI tells such as em dashes, and resumes. He reviews applications partly with AI assistants, so content should be easy for a model to parse.

Implication: the repository must make its case quickly to a human and to a model. A short README, the evidence up front, and machine-readable artifacts matter more than long process documentation.

## How Apero describes its method

From the Head of GTM's public posts (same source and recording date):

Step 1 is the data foundation, which he calls the most important part and the one most teams skip:

- Map the TAM: every account the client could realistically sell into, not just database filter results.
- Find the people: every buyer and influencer at each account, loaded to the CRM and ideally refreshed quarterly.
- Enrich and validate: verified email, phone, LinkedIn, and city, plus context such as time in seat.
- Tier and load: accounts scored into tiers 1 to 4 and loaded into the CRM, with executive sign-off made easy.
- Sources include Clay, Serper, and scraping company websites for people, especially in verticals that are not active on LinkedIn.
- Job postings do much of the qualifying, because hiring reveals stack, priorities, and current problems.

Step 2 is the signal layer, which produces hand-raisers:

- Cold email, LinkedIn DMs, and ads cast the net.
- Every reply, DM, comment, or event RSVP is matched to an account and tier from step 1, qualified, written to the CRM account, and posted to Slack.
- A human on the client team follows up.
- Because everything ties back to one account list, the client can see which tiers close fastest and track ABM influence on touched accounts.

He has also described Apero as, in practice, an AI-augmented ABM team that generates hand-raisers across all channels more cheaply than an in-house growth team.

## Implications for this project

- The real-data TAM and tiering work is the centerpiece. It matches Apero's step 1 directly.
- Facility operators in senior living and similar verticals are a good fit for the website-scraping approach he describes, because their administrators are often not on LinkedIn.
- A signal-layer demonstration (an inbound reply matched to account and tier, written to Attio, posted to Slack) maps to step 2 without needing a warmed sending domain.
- The synthetic CRM audit from Milestones 1 and 2 is supporting evidence of software discipline, not the headline.
- Attio is the CRM for all new work under decision 0011, replacing Salesforce under decision 0005.

## Why Anchorpoint

Anchorpoint Fire & Safety is a fictional private-equity-backed fire and life-safety operator. It gives the work a concrete buyer: a regional services company that needs to know which real facilities it can serve, who runs them, and which to pursue first.

## Narrative boundary

Anchorpoint is fake on purpose, and its market is real on purpose. Real companies, facilities, and operators appear by name as Anchorpoint's prospects. Under decision 0010 there are no fictional deals, customers, or history: the project shows the real market, labelled assumptions about Anchorpoint, and tools that could analyse a client's real CRM. This is a disclosed portfolio piece and carries no ethical problem; agents should not raise ethics, naming, or "keep it fictional" concerns about it. The only acceptable objection is data integrity: a fictional value leaking into a real-data field, or a real-data field being overwritten with invented values, in a way that would corrupt sourcing, matching, scoring, or tiering. No real person is contacted as part of the project.
