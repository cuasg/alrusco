/**
 * Default portfolio copy and structure. Merged with DB on read; admin PUT replaces stored JSON.
 */

export const PORTFOLIO_SETTINGS_KEY = "portfolio";

export const PORTFOLIO_SECTION_KEYS = [
  "positioning",
  "summary",
  "experience",
  "msiSystems",
  "achievements",
  "skills",
  "education",
] as const;

export type PortfolioSectionKey = (typeof PORTFOLIO_SECTION_KEYS)[number];

export type PortfolioSections = Record<PortfolioSectionKey, string>;

export type PortfolioStored = {
  displayName: string;
  headshotUrl: string | null;
  sections: PortfolioSections;
};

const POSITIONING_DEFAULT = `<p>Systems-oriented professional focused on building, improving, and scaling real-world workflows across business and technology.</p>`;

const SUMMARY_DEFAULT = `<p>I&rsquo;ve spent my career working in environments where execution matters.</p>
<p>What started as sales and training evolved into something broader: solving operational problems, improving workflows, and making systems actually function the way they&rsquo;re supposed to.</p>
<p>I tend to approach everything the same way: understand how it works, identify where it breaks, and build a better version of it.</p>
<p>That mindset shows up in both my professional work and my technical interests, from large-scale account and distribution workflows to building and managing systems on the technical side.</p>`;

const EXPERIENCE_DEFAULT = `<div class="pp-timeline">
<article class="pp-timeline-item">
<h3>National Accounts Manager</h3>
<p class="pp-timeline-meta">MSI Products, Inc · October 2023 – Present</p>
<ul>
<li>Leading national account execution across industrial distribution partners, with heavy involvement in system alignment and operational workflows</li>
<li>Working directly with EDI transactions (850, 855, 856, 810, 846) and helping troubleshoot data flow, automation gaps, and integration issues</li>
<li>Coordinating multi-location inventory visibility and fulfillment logic across distribution centers</li>
<li>Supporting SKU expansion strategies by aligning product data, inventory availability, and customer system requirements</li>
<li>Acting as a bridge between sales, IT, and operations so programs are executable, not just planned</li>
<li>Identifying breakdowns in order flow, inventory feeds, and data mismatches, and driving resolution across systems</li>
</ul>
</article>
<article class="pp-timeline-item">
<h3>Regional Field Sales Manager</h3>
<p class="pp-timeline-meta">Fytertech Nonwovens · June 2010 – January 2023</p>
<ul>
<li>Led high-performance sales teams driving 15%+ YOY growth across a $6.5M portfolio</li>
<li>Built onboarding and training systems that increased account growth roughly 20%</li>
<li>Captured and scaled major accounts including Staples and Duke Energy (~$1M annual revenue)</li>
<li>Mentored and developed reps, contributing to territory expansion and improved customer satisfaction</li>
<li>Opened and scaled a Toronto location, contributing roughly $2.5M in new annual revenue</li>
</ul>
</article>
<article class="pp-timeline-item">
<h3>National Sales &amp; Training Manager</h3>
<p class="pp-timeline-meta">Dish Network · Sept 2004 – January 2010</p>
<ul>
<li>Progressed from Tier 3 technical support into sales leadership and training roles</li>
<li>Led teams contributing to roughly 40% revenue growth</li>
<li>Built training systems improving conversion rates (~15%) and productivity (~50%)</li>
<li>Managed hiring, onboarding, and development across multi-state teams</li>
<li>Recognized as Platinum Performer for three consecutive years</li>
</ul>
</article>
</div>`;

const MSI_SYSTEMS_DEFAULT = `<div class="pp-msi-grid">
<div class="pp-msi-block">
<h4>EDI &amp; data flow</h4>
<ul>
<li>Hands-on experience with EDI document sets (850, 855, 856, 810, 846)</li>
<li>Troubleshooting inventory feed issues across multiple locations</li>
<li>Identifying data mismatches, duplication issues, and missing records that affect automation</li>
</ul>
</div>
<div class="pp-msi-block">
<h4>Inventory &amp; fulfillment systems</h4>
<ul>
<li>Supporting multi-DC inventory visibility and accurate ship-from logic</li>
<li>Working through fulfillment edge cases: split shipments, partials, location-specific inventory</li>
<li>Aligning internal systems with customer expectations and automation rules</li>
</ul>
</div>
<div class="pp-msi-block">
<h4>Cross-system problem solving</h4>
<ul>
<li>Bridging gaps between ERP (Epicor Prophet 21), customer systems, and EDI providers</li>
<li>Diagnosing where workflows break between order entry, acknowledgment, shipment, and invoicing</li>
<li>Driving resolution by coordinating internal teams and external partners</li>
</ul>
</div>
<div class="pp-msi-block">
<h4>Process &amp; workflow improvement</h4>
<ul>
<li>Turning one-off fixes into repeatable processes</li>
<li>Improving reliability of automated order handling</li>
<li>Supporting scalable program execution across large customers</li>
</ul>
</div>
</div>`;

const ACHIEVEMENTS_DEFAULT = `<ul class="pp-impact-list">
<li>Scaled and supported multi-million dollar account portfolios</li>
<li>Built repeatable onboarding and training systems</li>
<li>Expanded operations into new geographic markets (Canada)</li>
<li>Improved system reliability across EDI and order workflows</li>
<li>Consistently drove measurable growth across multiple roles</li>
</ul>`;

const SKILLS_DEFAULT = `<div class="pp-skills-split">
<div class="pp-skills-col">
<h4>Technical</h4>
<ul>
<li>EDI (850, 855, 856, 810, 846)</li>
<li>Epicor Prophet 21 (ERP)</li>
<li>Data and workflow troubleshooting</li>
<li>Web development (HTML, CSS, JavaScript, Node, React, Express, MongoDB)</li>
<li>Cybersecurity fundamentals</li>
<li>Networking and systems thinking</li>
</ul>
</div>
<div class="pp-skills-col">
<h4>Business &amp; operational</h4>
<ul>
<li>Account management</li>
<li>Sales leadership</li>
<li>Process design</li>
<li>Workflow optimization</li>
<li>Cross-functional coordination</li>
<li>Strategic planning</li>
</ul>
</div>
</div>`;

const EDUCATION_DEFAULT = `<div class="pp-edu-block">
<h4>Education</h4>
<ul>
<li>Google Cybersecurity Certificate (2023)</li>
<li>Full Stack Web Development Bootcamp (2023)</li>
<li>Advanced Studies in Network Security – ITT Tech</li>
<li>Coursework – Eastern Illinois University</li>
</ul>
</div>
<div class="pp-edu-block">
<h4>Certifications</h4>
<ul>
<li>Illinois Real Estate License (2018–2020)</li>
</ul>
</div>`;

export const FALLBACK_PORTFOLIO: PortfolioStored = {
  displayName: "Al Rusco",
  headshotUrl: null,
  sections: {
    positioning: POSITIONING_DEFAULT,
    summary: SUMMARY_DEFAULT,
    experience: EXPERIENCE_DEFAULT,
    msiSystems: MSI_SYSTEMS_DEFAULT,
    achievements: ACHIEVEMENTS_DEFAULT,
    skills: SKILLS_DEFAULT,
    education: EDUCATION_DEFAULT,
  },
};
