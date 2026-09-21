# Crestline Capital Compliance Guardrails

This document records implementation guardrails. It is not legal advice and does not establish that Crestline Capital is a regulated financial institution.

## Runtime policy

Regulated capabilities default to disabled:

- FEATURE_DEPOSITS_ENABLED=false
- FEATURE_WITHDRAWALS_ENABLED=false
- FEATURE_LOANS_ENABLED=false
- FEATURE_GRANTS_ENABLED=false
- FEATURE_YIELD_ENABLED=false
- FEATURE_COPY_TRADING_ENABLED=false
- FEATURE_CRYPTO_ENABLED=false

Changing a regulated feature to enabled requires an explicit operator decision and documented legal/compliance clearance appropriate to the deployment jurisdiction. The application must not silently enable these features.

## Capability review matrix

| Capability | Typical regulatory review | Implementation state |
|---|---|---|
| Deposits / money movement | Banking/payment licensing, safeguarding, AML/KYC, consumer protection | Disabled by default |
| Withdrawals | Payment/money-transmission licensing, safeguarding, AML/KYC | Disabled by default |
| Loans | Lending/credit licensing and disclosure requirements | Disabled by default |
| Grants | Program eligibility, source-of-funds and consumer-protection review | Disabled by default |
| Yield / ROI plans | Investment/securities/collective-investment review depending on structure | Disabled by default |
| Copy trading | Investment/portfolio-management and advisory review | Disabled by default |
| Crypto | Varies by custody, exchange, transfer and jurisdiction | Disabled by default |

## Jurisdiction checklist

Before enabling regulated functionality, obtain jurisdiction-specific legal review for the actual operating model and customer population, including at minimum:

- United States: federal/state banking, payments, money transmission, lending, securities, commodities, AML/KYC and consumer-protection requirements as applicable.
- United Kingdom: FCA perimeter, payment/e-money, consumer-credit, investment, cryptoasset and financial-promotion requirements as applicable.
- European Union: applicable payment/e-money, AML, consumer-credit, investment and cryptoasset requirements, including relevant member-state implementation.
- Australia: ASIC/APRA/AUSTRAC requirements applicable to the proposed activity, entity and customer flow.
- Canada: federal/provincial payments, lending, securities, AML and consumer-protection requirements applicable to the activity.

## Prohibited implementation shortcuts

- Do not fabricate regulator approval, licenses, tax authority status, or banking status.
- Do not build fake IRS/tax-payment workflows.
- Do not store raw card PAN or CVV data.
- Do not bypass audit logging for administrator actions.
- Do not enable a regulated feature merely because its UI exists.

## Regulatory Mode

The admin Settings area should expose the current regulatory mode and feature flags. A disabled flag must cause the corresponding regulated API to fail closed with FEATURE_DISABLED rather than performing a financial mutation.
