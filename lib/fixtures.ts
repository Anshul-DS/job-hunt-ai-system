/**
 * Six fixtures covering every gate that can drop a role, plus three scoring
 * behaviours. Ship them so the loop is testable end-to-end without hunting for
 * live postings mid-build (PRD.md §7).
 *
 * Fixtures 1-3 never reach the model — they're dropped by a gate, which is the
 * point of them.
 */

export interface Fixture {
  id: string;
  label: string;
  expectation: string;
  jd: string;
}

export const FIXTURES: Fixture[] = [
  {
    id: "gated-location",
    label: "1 · Gated out — location",
    expectation: "DROPPED at the location gate. Strong on every other axis, which is exactly why averaging would have let it through.",
    jd: `Senior Product Manager, Developer Platform
Beacon Systems — Vancouver, BC (onsite, 5 days/week in our Gastown office)

About the role
We're hiring a Senior Product Manager to own our developer platform and CI/CD tooling. You'll work with platform engineering teams to shape the roadmap for our build infrastructure, SDK, and API surface. This is an enterprise B2B SaaS product used by thousands of engineering teams.

Requirements
- 8+ years in product management, with 4+ in developer tools or DevEx
- Deep familiarity with continuous integration, observability, and the software supply chain
- Track record shipping enterprise software to technical buyers
- Experience with AI-assisted developer workflows a strong plus

Compensation: CAD 175,000 - 205,000 + equity. Permanent, full-time.
This role is onsite in Vancouver. Relocation assistance is available.`,
  },
  {
    id: "gated-seniority",
    label: "2 · Gated out — seniority",
    expectation: "DROPPED at the seniority floor. Remote Canada, Tier 1 domain — but below Senior.",
    jd: `Product Manager, Platform
Northwind Software — Remote (Canada)

We're looking for a Product Manager to join our platform team. You'll help define and ship features for our enterprise B2B SaaS developer tools product, working closely with engineering on our API platform and SDK.

What you'll do
- Write specs and user stories for platform capabilities
- Partner with DevOps and platform engineering on CI/CD tooling
- Support the senior PM on roadmap planning

Requirements
- 3+ years of product management experience
- Comfort working with technical teams and developer-facing products
- Strong written communication

Permanent, full-time. Remote within Canada. CAD 115,000 - 135,000.`,
  },
  {
    id: "gated-domain",
    label: "3 · Gated out — domain / title noise",
    expectation: "DROPPED at the domain gate. This is the noise filter working — the kind of posting an automated scraper would drag in.",
    jd: `Senior Territory Sales Manager
Meridian Medical Supply — Toronto, ON (hybrid, 3 days/week)

Join our growing sales organization as a Senior Territory Sales Manager covering the Greater Toronto Area. You'll manage a book of hospital and clinic accounts, drive new business, and hit quarterly revenue targets.

Responsibilities
- Own a territory quota and a pipeline of healthcare accounts
- Conduct product demonstrations of our surgical supply catalogue
- Build relationships with procurement leads and clinical staff

Requirements
- 6+ years of B2B sales experience, ideally in medical devices or healthcare
- Proven record of exceeding quota
- Valid driver's license and willingness to travel within the GTA

Permanent, full-time. Base CAD 95,000 + uncapped commission.`,
  },
  {
    id: "strong-match",
    label: "4 · Strong match",
    expectation: "Survives all four gates and should score high — Tier 1 domain, permanent, above the seniority floor, real agentic scope.",
    jd: `Staff Product Manager, Agentic Developer Experience
Larkspur — Remote (Canada) or Toronto, ON

About Larkspur
Larkspur builds enterprise B2B SaaS developer tools used by platform engineering teams at Fortune 500 companies. Our CI/CD and observability products sit at the centre of the software supply chain for thousands of engineering organizations.

The role
We're hiring a Staff Product Manager to lead our agentic developer experience initiative. You'll define how AI agents participate in our CI/CD pipeline — where they act as triggers, where they act as steps, and what trust mechanisms gate each. This is a net-new product surface with executive visibility.

What you'll do
- Own the roadmap for AI-assisted and agentic capabilities across our DevEx platform
- Define the boundary between deterministic automation and model-driven judgment in our pipeline
- Partner with ML and platform engineering on evaluation methodology for agent output quality
- Work directly with enterprise customers on rollout and governance

Requirements
- 10+ years in product management, with significant time in developer tools or DevEx
- Experience shipping enterprise software to technical buyers
- Demonstrated work on AI or agentic product surfaces
- Strong point of view on where automation ends and model judgment begins

Compensation: CAD 190,000 - 225,000 + equity. Permanent, full-time.
Remote-friendly across Canada; Toronto office optional.`,
  },
  {
    id: "survives-low",
    label: "5 · Survives but scores low",
    expectation: "Survives (fintech is Tier 3, still in scope) but scores low on domain and engagement. Salary's low weight keeps it from dragging the total further — this is the fixture that proves the original bug is fixed.",
    jd: `Senior Product Manager, Payments Operations
Halcyon Financial — Remote (Canada)

Halcyon Financial is a fintech company building payments and treasury infrastructure for mid-market businesses. We process accounts receivable and reconciliation workflows for over 4,000 customers.

The role
We're seeking a Senior Product Manager to own our payments operations product line. You'll work on reconciliation, settlement, and the financial services integrations that power our platform.

Requirements
- 6+ years of product management experience
- Background in fintech, payments, or financial services
- Comfort with compliance-heavy product environments
- Experience with banking integrations preferred

Engagement: 12-month contract with possibility of extension.
Compensation: CAD 115,000 - 128,000 annualized. Remote within Canada.`,
  },
  {
    id: "resume-mismatch",
    label: "6 · Resume mismatch",
    expectation: "Survives every gate and looks strong on paper — Tier 1, permanent, Staff level. But if the master resume doesn't evidence the deep technical requirements, resume fit should pull the total down on its own.",
    jd: `Staff Product Manager, ML Infrastructure
Cormorant Labs — Remote (Canada)

Cormorant Labs builds the machine learning platform and data infrastructure powering real-time inference for enterprise customers. Our AI platform serves billions of predictions daily.

The role
We're hiring a Staff Product Manager to own our ML infrastructure product: model serving, feature stores, training orchestration, and the data platform underneath them. You will be the primary product voice in deeply technical architecture decisions.

Requirements
- 8+ years in product management, with 5+ owning ML infrastructure or data platform products
- Hands-on familiarity with model training pipelines, feature engineering, and inference optimization
- Ability to read and reason about distributed systems design documents
- Prior experience as an ML engineer or data engineer strongly preferred
- Track record defining evaluation methodology for model quality in production
- Deep knowledge of GPU scheduling, model quantization, and serving latency trade-offs

Compensation: CAD 195,000 - 230,000 + equity. Permanent, full-time. Remote within Canada.`,
  },
];
