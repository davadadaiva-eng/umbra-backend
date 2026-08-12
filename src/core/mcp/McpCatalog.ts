import { McpConnectorConfig } from '../../types';

/**
 * Master MCP Connector Catalog — every tool a user can connect to.
 *
 * Two kinds of entries:
 *   - `kind: 'verified'`  — real, publicly-documented services/connectors with
 *     a known endpoint convention or a stable remote MCP endpoint where one
 *     is published. `baseUrl` is the documented default; users can override it
 *     after connecting (many MCP servers are self-hosted via `npx`/Docker).
 *   - `kind: 'template'`  — connectors referenced by the UmbraOS master
 *     documentation / skill matrix. No public endpoint is published yet, so
 *     `baseUrl` starts empty and the user supplies it. Kept so every skill in
 *     the matrix has a slot in the catalog.
 *
 * `enabled` is always `false` in the catalog; the user enables a connector
 * through the connect flow (API route or config edit), which persists the
 * entry into `config.mcp.connectors` and (for secret-bearing connectors)
 * an encrypted credential in the CredentialVault.
 */

type AuthType = McpConnectorConfig['authType'];

export interface McpCatalogEntry extends McpConnectorConfig {
  kind: 'verified' | 'template';
  description: string;
  /** Documentation / repo hint surfaced to the user when connecting. */
  docs?: string;
}

type Row = [
  name: string,
  baseUrl: string,
  auth: AuthType,
  header: string | undefined,
  credentialKey: string | undefined,
  kind: 'verified' | 'template',
  description: string,
  docs?: string,
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function build(category: string, rows: Row[]): McpCatalogEntry[] {
  return rows.map(([name, baseUrl, auth, header, credentialKey, kind, description, docs]) => ({
    id: `${slug(category)}-${slug(name)}`,
    name,
    category,
    baseUrl,
    authType: auth,
    apiKeyHeader: header,
    credentialKey,
    kind,
    enabled: false,
    description,
    docs,
  }));
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  // ── Developer / Code ─────────────────────────────────────────────
  ...build('Developer', [
    ['GitHub', 'https://api.githubcopilot.com/mcp/', 'bearer', 'Authorization', 'github', 'verified', 'Repos, issues, PRs, and code search.', 'https://github.com/github/github-mcp-server'],
    ['GitLab', '', 'bearer', 'Authorization', 'gitlab', 'verified', 'Projects, merge requests, CI, and runners via the GitLab API.', 'https://gitlab.com/gitlab-org/components/ai/tools'],
    ['Bitbucket', '', 'bearer', 'Authorization', 'bitbucket', 'verified', 'Workspaces, repos, and pull requests on Bitbucket Cloud.'],
    ['Git (local)', '', 'none', undefined, undefined, 'verified', 'Local repository read, commit, branch, and diff operations.'],
    ['Sourcegraph', '', 'bearer', 'Authorization', 'sourcegraph', 'verified', 'Universal code search and context from the Sourcegraph API.'],
    ['RepoGuide', '', 'bearer', 'Authorization', 'repoguide', 'template', 'Repo-aware onboarding and codebase navigation guides.'],
    ['Static Analysis', '', 'apiKey', 'X-API-Key', 'static-analysis', 'verified', 'Lint, type, and security analysis of a working checkout.'],
    ['Code Review', '', 'bearer', 'Authorization', 'code-review', 'verified', 'AI/agent-driven review comments and patch feedback.'],
    ['Package Registry', '', 'bearer', 'Authorization', 'package-registry', 'verified', 'Publish and inspect packages for NPM/PyPI/Maven ecosystems.'],
  ]),

  // ── Software project management ──────────────────────────────────
  ...build('Project Management', [
    ['Notion', '', 'bearer', 'Authorization', 'notion', 'verified', 'Databases, pages, and full-text search in Notion.', 'https://github.com/makenotion/notion-mcp-server'],
    ['Linear', '', 'oauth', 'Authorization', 'linear', 'verified', 'Issues, cycles, and roadmaps in Linear.', 'https://github.com/linearapp/linear-mcp-server'],
    ['Jira', '', 'bearer', 'Authorization', 'jira', 'verified', 'Issues, sprints, boards, and epics on Jira Cloud.', 'https://github.com/sooperset/mcp-atlassian'],
    ['Confluence', '', 'bearer', 'Authorization', 'confluence', 'verified', 'Pages, spaces, and search in Confluence.'],
    ['Trello', '', 'bearer', 'Authorization', 'trello', 'verified', 'Boards, lists, cards, and comments in Trello.'],
    ['Asana', '', 'bearer', 'Authorization', 'asana', 'verified', 'Tasks, projects, and teams in Asana.'],
    ['Monday.com', '', 'bearer', 'Authorization', 'monday', 'verified', 'Boards, items, and updates on monday.com.'],
    ['ClickUp', '', 'apiKey', 'Authorization', 'clickup', 'verified', 'Tasks, lists, and goals in ClickUp.'],
    ['Todoist', '', 'bearer', 'Authorization', 'todoist', 'verified', 'Tasks and projects in Todoist.'],
    ['Height', '', 'bearer', 'Authorization', 'height', 'verified', 'Tasks and projects in Height.'],
    ['Shortcut', '', 'bearer', 'Authorization', 'shortcut', 'verified', 'Stories and epics in Shortcut Clubhouse.'],
    ['Basecamp', '', 'bearer', 'Authorization', 'basecamp', 'verified', 'Projects, todos, and messages in Basecamp.'],
    ['Pivotal Tracker', '', 'apiKey', 'X-TrackerToken', 'pivotal', 'template', 'Stories, iterations, and velocity on Pivotal Tracker.'],
  ]),

  // ── Communication / Messaging ────────────────────────────────────
  ...build('Communication', [
    ['Slack', '', 'bearer', 'Authorization', 'slack', 'verified', 'Channels, messages, threads, and reactions on Slack.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack'],
    ['Discord', '', 'bearer', 'Authorization', 'discord', 'verified', 'Servers, channels, and messages on Discord.'],
    ['Microsoft Teams', '', 'oauth', 'Authorization', 'teams', 'verified', 'Teams, channels, chats, and meetings in Microsoft Teams.'],
    ['Telegram', '', 'apiKey', 'X-API-Key', 'telegram', 'verified', 'Send and receive messages through the Telegram Bot API.'],
    ['WhatsApp', '', 'apiKey', 'X-API-Key', 'whatsapp', 'verified', 'WhatsApp Business messaging via the Cloud API.'],
    ['Mattermost', '', 'bearer', 'Authorization', 'mattermost', 'verified', 'Channels and posts on a self-hosted Mattermost.'],
    ['Zulip', '', 'apiKey', 'X-API-Key', 'zulip', 'verified', 'Streams, topics, and messages in Zulip.'],
    ['Webex', '', 'bearer', 'Authorization', 'webex', 'verified', 'Spaces and messages on Cisco Webex.'],
    ['Email (SMTP)', '', 'none', undefined, undefined, 'verified', 'Send and inspect email through a local SMTP/IMAP connection.'],
  ]),

  // ── Productivity / Documents ─────────────────────────────────────
  ...build('Productivity', [
    ['Google Drive', '', 'oauth', 'Authorization', 'google-drive', 'verified', 'Files, folders, and full-text search in Google Drive.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive'],
    ['Google Calendar', '', 'oauth', 'Authorization', 'google-calendar', 'verified', 'Events, availability, and scheduling on Google Calendar.'],
    ['Google Docs', '', 'oauth', 'Authorization', 'google-docs', 'verified', 'Create and edit documents in Google Docs.'],
    ['Google Sheets', '', 'oauth', 'Authorization', 'google-sheets', 'verified', 'Read, write, and format spreadsheets in Google Sheets.'],
    ['Gmail', '', 'oauth', 'Authorization', 'gmail', 'verified', 'Draft, send, and search email in Gmail.', 'https://github.com/GongRzhe/Gmail-MCP-Server'],
    ['Microsoft 365', '', 'oauth', 'Authorization', 'microsoft-365', 'verified', 'Files, mail, calendar, and OneDrive for Microsoft 365.'],
    ['OneDrive', '', 'oauth', 'Authorization', 'onedrive', 'verified', 'Files and folders in OneDrive.'],
    ['Dropbox', '', 'oauth', 'Authorization', 'dropbox', 'verified', 'Files, folders, and sharing in Dropbox.'],
    ['Box', '', 'oauth', 'Authorization', 'box', 'verified', 'Files and collaboration in Box.'],
    ['Notion Calendar', '', 'oauth', 'Authorization', 'notion-calendar', 'verified', 'Calendar events backed by Notion databases.'],
    ['Obsidian', '', 'apiKey', 'Authorization', 'obsidian', 'verified', 'Vault navigation and note search via the Local REST API.'],
    ['Evernote', '', 'oauth', 'Authorization', 'evernote', 'verified', 'Notes, notebooks, and tags in Evernote.'],
    ['Roam Research', '', 'apiKey', 'Authorization', 'roam', 'template', 'Blocks, pages, and graph queries in Roam.'],
    ['XMind', '', 'none', undefined, undefined, 'template', 'Mind map creation and export.'],
  ]),

  // ── Data / Analytics / Databases ─────────────────────────────────
  ...build('Data & Analytics', [
    ['PostgreSQL', '', 'none', undefined, undefined, 'verified', 'Query and introspect PostgreSQL schemas and tables.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres'],
    ['MySQL', '', 'none', undefined, undefined, 'verified', 'Query MySQL databases and inspect schemas.'],
    ['SQLite', '', 'none', undefined, undefined, 'verified', 'Local file-backed SQLite read/write and schema inspection.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite'],
    ['MongoDB', '', 'none', undefined, undefined, 'verified', 'Document CRUD and aggregation on MongoDB.'],
    ['Redis', '', 'apiKey', 'X-API-Key', 'redis', 'verified', 'Key/value, lists, and pub-sub against Redis.'],
    ['ClickHouse', '', 'none', undefined, undefined, 'verified', 'Column-oriented SQL queries against ClickHouse.'],
    ['DuckDB', '', 'none', undefined, undefined, 'verified', 'In-memory SQL analytics over local files and parquet.'],
    ['Snowflake', '', 'bearer', 'Authorization', 'snowflake', 'verified', 'Warehouse queries, tables, and views on Snowflake.'],
    ['BigQuery', '', 'oauth', 'Authorization', 'bigquery', 'verified', 'Warehouse SQL, datasets, and jobs on Google BigQuery.'],
    ['Redshift', '', 'bearer', 'Authorization', 'redshift', 'verified', 'Warehouse queries on Amazon Redshift.'],
    ['Databricks', '', 'bearer', 'Authorization', 'databricks', 'verified', 'Catalogs, tables, and notebooks on Databricks.'],
    ['Supabase', '', 'bearer', 'Authorization', 'supabase', 'verified', 'Postgres, auth, storage, and Edge Functions on Supabase.'],
    ['Firebase', '', 'apiKey', 'X-API-Key', 'firebase', 'verified', 'Firestore, Realtime DB, and auth on Firebase.'],
    ['PocketBase', '', 'bearer', 'Authorization', 'pocketbase', 'verified', 'Collections, records, and files on PocketBase.'],
    ['Neon', '', 'bearer', 'Authorization', 'neon', 'verified', 'Postgres branches and databases on Neon.'],
    ['PlanetScale', '', 'bearer', 'Authorization', 'planetscale', 'verified', 'MySQL branches and deployments on PlanetScale.'],
    ['Turso', '', 'bearer', 'Authorization', 'turso', 'verified', 'libSQL databases on Turso.'],
    ['D1', '', 'bearer', 'Authorization', 'cloudflare-d1', 'verified', 'Cloudflare D1 SQLite on the edge.'],
    ['Airtable', '', 'bearer', 'Authorization', 'airtable', 'verified', 'Bases, tables, and records in Airtable.', 'https://github.com/idme/airtable-mcp-server'],
    ['SheetsDB', '', 'none', undefined, undefined, 'template', 'Spreadsheet-as-database query layer.'],
  ]),

  // ── Search / Web / Research ──────────────────────────────────────
  ...build('Search & Research', [
    ['Brave Search', '', 'apiKey', 'X-Subscription-Token', 'brave', 'verified', 'Web news, image, and video search via Brave.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search'],
    ['Firecrawl', 'https://api.firecrawl.dev/', 'bearer', 'Authorization', 'firecrawl', 'verified', 'Web scraping, crawling, and markdown extraction.', 'https://github.com/firecrawl/mcp-server-firecrawl'],
    ['Perplexity', 'https://api.perplexity.ai/', 'bearer', 'Authorization', 'perplexity', 'verified', 'Answered research queries powered by Perplexity soma pages.'],
    ['Exa', '', 'bearer', 'Authorization', 'exa', 'verified', 'Neural web search with semantic relevance.'],
    ['Tavily', '', 'bearer', 'Authorization', 'tavily', 'verified', 'Search API built for LLM agents and RAG.'],
    ['Google Search', '', 'apiKey', 'X-API-Key', 'google-search', 'verified', 'Search via the Programmable Search Engine.'],
    ['Serper', '', 'apiKey', 'X-API-Key', 'serper', 'verified', 'Google SERP results as structured JSON.'],
    ['SearXNG', '', 'none', undefined, undefined, 'verified', 'Self-hosted metasearch engine endpoint.'],
    ['Fetch (web)', '', 'none', undefined, undefined, 'verified', 'Fetch and convert web pages to markdown.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch'],
    ['ArXiv', '', 'none', undefined, undefined, 'verified', 'Search and retrieve papers from arXiv.'],
    ['PubMed', '', 'none', undefined, undefined, 'verified', 'Search biomedical literature via PubMed.'],
    ['Wikipedia', '', 'none', undefined, undefined, 'verified', 'Article summaries, links, and search from Wikipedia.'],
    ['NewsAPI', '', 'apiKey', 'X-Api-Key', 'newsapi', 'verified', 'Live headlines and articles from NewsAPI.org.'],
    ['Crossref', '', 'none', undefined, undefined, 'verified', 'Scholarly metadata and DOI resolution via Crossref.'],
    ['Semantic Scholar', '', 'apiKey', 'X-API-Key', 'semantic-scholar', 'verified', 'Paper search, citations, and embeddings by topic.'],
    ['Free Patent', '', 'none', undefined, undefined, 'verified', 'Patent metadata search over world patent offices.'],
    ['Internet Archive', '', 'none', undefined, undefined, 'verified', 'Page snapshots and media from the Wayback Machine.'],
  ]),

  // ── AI / Machine Learning ────────────────────────────────────────
  ...build('AI & ML', [
    ['OpenAI', '', 'apiKey', 'Authorization', 'openai', 'verified', 'Calls to OpenAI models, files, and assistants.'],
    ['Anthropic', '', 'apiKey', 'x-api-key', 'anthropic', 'verified', 'Claude model calls and message handling.'],
    ['Ollama', '', 'none', undefined, undefined, 'verified', 'Local model serving, pull, and generate endpoints.'],
    ['Hugging Face', '', 'bearer', 'Authorization', 'huggingface', 'verified', 'Inference, datasets, and model metadata on HF.'],
    ['Pinecone', '', 'apiKey', 'Api-Key', 'pinecone', 'verified', 'Vector storage and upsert/query indexes on Pinecone.'],
    ['Weaviate', '', 'bearer', 'Authorization', 'weaviate', 'verified', 'Vector database with hybrid search.'],
    ['Qdrant', '', 'apiKey', 'api-key', 'qdrant', 'verified', 'High-performance vector similarity search.'],
    ['Milvus', '', 'bearer', 'Authorization', 'milvus', 'verified', 'Distributed vector database.'],
    ['Chroma', '', 'none', undefined, undefined, 'verified', 'Local embeddable vector store and collections.'],
    ['PgVector', '', 'none', undefined, undefined, 'verified', 'Vector search inside PostgreSQL.'],
    ['Algolia', '', 'apiKey', 'X-Algolia-API-Key', 'algolia', 'verified', 'Full-text and typo-tolerant search on Algolia.'],
    ['Meilisearch', '', 'apiKey', 'Authorization', 'meilisearch', 'verified', 'Lightning-fast full-text search engine.'],
    ['Elasticsearch', '', 'apiKey', 'Authorization', 'elasticsearch', 'verified', 'Full-text search and analytics on Elastic.'],
    ['OpenSearch', '', 'apiKey', 'Authorization', 'opensearch', 'verified', 'Search and analytics on OpenSearch.'],
    ['Nomic Atlas', '', 'apiKey', 'X-API-Key', 'nomic', 'template', 'Map, embed, and navigate unstructured text corpora.'],
    ['Voyage AI', '', 'apiKey', 'Authorization', 'voyage', 'verified', 'Domain-specialized embeddings API.'],
    ['Jina AI', '', 'apiKey', 'Authorization', 'jina', 'verified', 'Embeddings, reranking, and reader endpoints.'],
    ['Langsmith', '', 'apiKey', 'X-API-Key', 'langsmith', 'verified', 'Trace, evaluate, and monitor agent runtimes.'],
    ['Prompt Library', '', 'none', undefined, undefined, 'template', 'Store and version reuse prompts.'],
  ]),

  // ── Cloud / DevOps / Infrastructure ──────────────────────────────
  ...build('Cloud & DevOps', [
    ['AWS', '', 'bearer', 'Authorization', 'aws', 'verified', 'EC2, S3, Lambda, IAM, and more on AWS.'],
    ['AWS S3', '', 'bearer', 'Authorization', 'aws-s3', 'verified', 'Object storage buckets and keys.'],
    ['Azure', '', 'bearer', 'Authorization', 'azure', 'verified', 'Compute, storage, and identity on Azure.'],
    ['Google Cloud', '', 'oauth', 'Authorization', 'gcp', 'verified', 'Compute, storage, and services on Google Cloud.'],
    ['Docker', '', 'none', undefined, undefined, 'verified', 'Build, run, and inspect containers and images.'],
    ['Kubernetes', '', 'bearer', 'Authorization', 'kubernetes', 'verified', 'Pods, deployments, and services via the k8s API.'],
    ['Terraform', '', 'none', undefined, undefined, 'verified', 'Plan, apply, and inspect Terraform state.'],
    ['Helm', '', 'none', undefined, undefined, 'verified', 'Charts, releases, and repositories for Kubernetes.'],
    ['Ansible', '', 'none', undefined, undefined, 'verified', 'Playbook runs and inventory management.'],
    ['Cloudflare', '', 'apiKey', 'Authorization', 'cloudflare', 'verified', 'DNS, workers, pages, and cache on Cloudflare.'],
    ['Vercel', '', 'bearer', 'Authorization', 'vercel', 'verified', 'Deployments, projects, and domains on Vercel.'],
    ['Netlify', '', 'bearer', 'Authorization', 'netlify', 'verified', 'Sites, deploys, and builds on Netlify.'],
    ['Railway', '', 'bearer', 'Authorization', 'railway', 'verified', 'Services, deploys, and metrics on Railway.'],
    ['Render', '', 'bearer', 'Authorization', 'render', 'verified', 'Web services, cron jobs, and databases on Render.'],
    ['Fly.io', '', 'apiKey', 'Authorization', 'flyio', 'verified', 'Apps and machines on Fly.io.'],
    ['Heroku', '', 'bearer', 'Authorization', 'heroku', 'verified', 'Apps, dynos, and add-ons on Heroku.'],
    ['GitHub Actions', '', 'bearer', 'Authorization', 'github-actions', 'verified', 'Workflows, runs, and secrets on GitHub Actions.'],
    ['GitLab CI', '', 'bearer', 'Authorization', 'gitlab-ci', 'verified', 'Pipelines and jobs on GitLab CI.'],
    ['Jenkins', '', 'bearer', 'Authorization', 'jenkins', 'verified', 'Jobs, builds, and artifacts on Jenkins.'],
    ['CircleCI', '', 'apiKey', 'Token', 'circleci', 'verified', 'Pipelines and builds on CircleCI.'],
    ['Buildkite', '', 'bearer', 'Authorization', 'buildkite', 'verified', 'Pipelines and builds on Buildkite.'],
    ['Traefik', '', 'none', undefined, undefined, 'verified', 'Routes, services, and health via the Traefik API.'],
    ['Caddy', '', 'none', undefined, undefined, 'verified', 'Reverse proxy routes and TLS certs via Admin API.'],
    ['Nginx', '', 'none', undefined, undefined, 'verified', 'Server config generation and reload via control socket.'],
    ['Consul', '', 'bearer', 'Authorization', 'consul', 'verified', 'Service discovery and KV store on HashiCorp Consul.'],
    ['Vault (HashiCorp)', '', 'bearer', 'Authorization', 'hashicorp-vault', 'verified', 'Secrets, tokens, and policies on HashiCorp Vault.'],
  ]),

  // ── Observability / Monitoring ───────────────────────────────────
  ...build('Observability', [
    ['Datadog', '', 'apiKey', 'DD-API-KEY', 'datadog', 'verified', 'Metrics, logs, traces, and monitors on Datadog.'],
    ['Grafana', '', 'bearer', 'Authorization', 'grafana', 'verified', 'Dashboards, datasources, and alerts on Grafana.'],
    ['Prometheus', '', 'none', undefined, undefined, 'verified', 'Metrics queries and target discovery on Prometheus.'],
    ['Loki', '', 'bearer', 'Authorization', 'loki', 'verified', 'Log aggregation and LogQL queries.'],
    ['Sentry', '', 'bearer', 'Authorization', 'sentry', 'verified', 'Issues, events, and release monitoring on Sentry.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/sentry'],
    ['New Relic', '', 'apiKey', 'Api-Key', 'newrelic', 'verified', 'Metrics, log, and trace queries on New Relic.'],
    ['CloudWatch', '', 'bearer', 'Authorization', 'cloudwatch', 'verified', 'Metrics, logs, and alarms on AWS CloudWatch.'],
    ['Kibana', '', 'bearer', 'Authorization', 'kibana', 'verified', 'Discover, dashboards, and alerts on Kibana.'],
    ['BetterStack', '', 'bearer', 'Authorization', 'betterstack', 'verified', 'Uptime monitors, incidents, and logs on BetterStack.'],
    ['Uptime Robot', '', 'apiKey', 'X-API-Key', 'uptimerobot', 'verified', 'Monitors, status pages, and alerts.'],
    ['PagerDuty', '', 'bearer', 'Authorization', 'pagerduty', 'verified', 'Incidents, on-call, and escalation policies.'],
    ['OpsGenie', '', 'apiKey', 'Authorization', 'opsgenie', 'verified', 'Alerts, teams, and on-call schedules.'],
    ['StatusPage', '', 'apiKey', 'Authorization', 'statuspage', 'verified', 'Components, incidents, and subscribers.'],
  ]),

  // ── CRM / Sales / Marketing ──────────────────────────────────────
  ...build('CRM & Marketing', [
    ['Salesforce', '', 'bearer', 'Authorization', 'salesforce', 'verified', 'Accounts, contacts, opportunities, and queries on Salesforce.'],
    ['HubSpot', '', 'bearer', 'Authorization', 'hubspot', 'verified', 'Contacts, companies, deals, and tickets on HubSpot.'],
    ['Zendesk', '', 'bearer', 'Authorization', 'zendesk', 'verified', 'Tickets, users, and views on Zendesk.'],
    ['Intercom', '', 'bearer', 'Authorization', 'intercom', 'verified', 'Conversations, users, and help center on Intercom.'],
    ['Freshworks', '', 'bearer', 'Authorization', 'freshdesk', 'verified', 'Tickets and contacts on Freshdesk.'],
    ['Klaviyo', '', 'apiKey', 'Authorization', 'klaviyo', 'verified', 'Segments, events, and email flows in Klaviyo.'],
    ['Mailchimp', '', 'bearer', 'Authorization', 'mailchimp', 'verified', 'Audiences, campaigns, and reports in Mailchimp.'],
    ['SendGrid', '', 'apiKey', 'Authorization', 'sendgrid', 'verified', 'Transactional email sends and analytics.'],
    ['Resend', '', 'apiKey', 'Authorization', 'resend', 'verified', 'Email API for transactional and bulk sends.'],
    ['Postmark', '', 'apiKey', 'X-Postmark-Server-Token', 'postmark', 'verified', 'Transactional email delivery and webhooks.'],
    ['Brevo', '', 'apiKey', 'api-key', 'brevo', 'verified', 'Email campaigns, contacts, and automation on Brevo.'],
    ['Mailgun', '', 'apiKey', 'Api-Key', 'mailgun', 'verified', 'Email sending, routing, and validation.'],
    ['MailerSend', '', 'apiKey', 'Authorization', 'mailerlite', 'verified', 'Email delivery and analytics on MailerSend.'],
    ['Customer.io', '', 'bearer', 'Authorization', 'customerio', 'verified', 'Events, segments, and campaigns on Customer.io.'],
    ['Segment', '', 'bearer', 'Authorization', 'segment', 'verified', 'Track, identify, and source access on Segment.'],
    ['Mixpanel', '', 'apiKey', 'Authorization', 'mixpanel', 'verified', 'Events, funnels, and user profiles in Mixpanel.'],
    ['Amplitude', '', 'bearer', 'Authorization', 'amplitude', 'verified', 'Events, cohorts, and charts in Amplitude.'],
    ['Google Analytics', '', 'oauth', 'Authorization', 'ga4', 'verified', 'Properties, reports, and metrics on GA4.'],
    ['Hotjar', '', 'bearer', 'Authorization', 'hotjar', 'verified', 'Heatmaps, recordings, and feedback on Hotjar.'],
    ['Kissmetrics', '', 'none', undefined, undefined, 'template', 'Retention and cohort analysis queries.'],
  ]),

  // ── Payments / Fintech / Accounting ──────────────────────────────
  ...build('Payments & Finance', [
    ['Stripe', '', 'apiKey', 'Authorization', 'stripe', 'verified', 'Customers, products, payments, and subscriptions on Stripe.', 'https://github.com/stripe/agent-toolkit'],
    ['Shopify', '', 'bearer', 'Authorization', 'shopify', 'verified', 'Products, orders, customers, and inventory on Shopify.'],
    ['PayPal', '', 'oauth', 'Authorization', 'paypal', 'verified', 'Payments, orders, and refunds on PayPal.'],
    ['Square', '', 'bearer', 'Authorization', 'square', 'verified', 'Payments, catalog, and customers on Square.'],
    ['Adyen', '', 'apiKey', 'X-API-Key', 'adyen', 'verified', 'Payments, payouts, and data capture on Adyen.'],
    ['Plaid', '', 'bearer', 'Authorization', 'plaid', 'verified', 'Accounts, transactions, and balance data via Plaid.'],
    ['Coinbase', '', 'apiKey', 'Authorization', 'coinbase', 'verified', 'Portfolio, exchange, and prices on Coinbase.'],
    ['Binance', '', 'apiKey', 'X-MBX-APIKEY', 'binance', 'verified', 'Market data, orders, and balances on Binance.'],
    ['Kraken', '', 'apiKey', 'API-Key', 'kraken', 'verified', 'Ticker, order book, and trades on Kraken.'],
    ['Alpaca', '', 'apiKey', 'Authorization', 'alpaca', 'verified', 'US equities trading, orders, and positions.'],
    ['Alpha Vantage', '', 'apiKey', 'apikey', 'alphavantage', 'verified', 'Stock and FX time series via Alpha Vantage.'],
    ['Twelve Data', '', 'apiKey', 'X-API-KEY', 'twelvedata', 'verified', 'Market data quotes and time series.'],
    ['QuickBooks', '', 'oauth', 'Authorization', 'quickbooks', 'verified', 'Invoices, bills, and accounts in QuickBooks Online.'],
    ['Xero', '', 'oauth', 'Authorization', 'xero', 'verified', 'Invoices, contacts, and accounts in Xero.'],
    ['FreshBooks', '', 'oauth', 'Authorization', 'freshbooks', 'verified', 'Invoices, expenses, and clients on FreshBooks.'],
    ['Wave', '', 'oauth', 'Authorization', 'wave', 'verified', 'Invoices, payments, and accounting on Wave.'],
    ['F24 Tax Calculator', '', 'none', undefined, undefined, 'template', 'Italian F24 form calculation and generation.', undefined],
    ['Deductions Engine', '', 'none', undefined, undefined, 'template', 'Legal tax deduction and relief discovery.'],
    ['E-Fattura Validator', '', 'none', undefined, undefined, 'template', 'Formal and semantic validation of electronic invoices (SDI).'],
    ['Cassetto Fiscale', '', 'bearer', 'Authorization', 'cassetto-fiscale', 'template', 'Sync with institutional Italian tax portals.'],
  ]),

  // ── Voice / Telephony / Media ────────────────────────────────────
  ...build('Voice & Media', [
    ['Twilio', '', 'apiKey', 'Authorization', 'twilio', 'verified', 'SMS, voice, and WhatsApp via Twilio.', 'https://github.com/lukethacoder/mcp-twilio'],
    ['Telnyx', '', 'apiKey', 'Authorization', 'telnyx', 'verified', 'SMS, voice, and numbers via the Telnyx API.', 'https://github.com/teamopenindustry/MCP-Server-Time'],
    ['Vonage', '', 'apiKey', 'Authorization', 'vonage', 'verified', 'SMS, voice, and number lookup on Vonage.'],
    ['YouTube', '', 'apiKey', 'Authorization', 'youtube', 'verified', 'Channel, video, and analytics data on YouTube.', 'https://github.com/ZubeidHendricks/mcp-youtube-data-api'],
    ['Vimeo', '', 'bearer', 'Authorization', 'vimeo', 'verified', 'Videos, uploads, and metadata on Vimeo.'],
    ['Twitch', '', 'oauth', 'Authorization', 'twitch', 'verified', 'Streams, channels, and clips on Twitch.'],
    ['FFmpeg', '', 'none', undefined, undefined, 'verified', 'Video and audio transcoding, cutting, and merging.'],
    ['Whisper', '', 'apiKey', 'Authorization', 'whisper', 'verified', 'Local or remote speech-to-text transcription.'],
    ['ElevenLabs', '', 'apiKey', 'xi-api-key', 'elevenlabs', 'verified', 'TTS, voice cloning, and sound generation.'],
    ['OpenAI Audio', '', 'apiKey', 'Authorization', 'openai-audio', 'verified', 'TTS, STT, and audio moderation endpoints.'],
    ['AgentPhone', '', 'bearer', 'Authorization', 'agentphone', 'template', 'Realtime bidirectional conversational voice calling.'],
    ['Newsroom Engine', '', 'none', undefined, undefined, 'template', 'Multi-track timeline and intelligent video clipping.'],
    ['Remotion Render', 'http://localhost:3000', 'none', undefined, undefined, 'template', 'Headless programmatic video rendering via Remotion.'],
    ['Subtitle Sync', '', 'none', undefined, undefined, 'template', 'Multilingual audio timing adaptation and dubbing sync.'],
  ]),

  // ── Local / OS / Browser ─────────────────────────────────────────
  ...build('Local & Desktop', [
    ['Filesystem', '', 'none', undefined, undefined, 'verified', 'Local file read/write/list with sandboxing.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem'],
    ['Memory', '', 'none', undefined, undefined, 'verified', 'Long-term knowledge graph memory store.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory'],
    ['Puppeteer', '', 'none', undefined, undefined, 'verified', 'Browser automation and page inspection.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer'],
    ['Playwright', '', 'none', undefined, undefined, 'verified', 'Cross-browser automation, screenshots, and scraping.'],
    ['Sequential Thinking', '', 'none', undefined, undefined, 'verified', 'Structured reasoning and planning tool.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking'],
    ['Everything', '', 'none', undefined, undefined, 'verified', 'Local file search across the whole Windows machine.'],
    ['Time', '', 'none', undefined, undefined, 'verified', 'Clock, timezone, and calendar math.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/time'],
    ['Context', '', 'none', undefined, undefined, 'template', 'Cached workspace and session context store.'],
    ['Desktop Notifications', '', 'none', undefined, undefined, 'verified', 'Native Windows toast notifications.'],
    ['Clipboard', '', 'none', undefined, undefined, 'verified', 'Read and write the OS clipboard.'],
    ['Process Manager', '', 'none', undefined, undefined, 'template', 'List, start, and stop local processes.'],
  ]),

  // ── PDF master-document domains (templates by default) ──────────
  ...build('Business & Legal', [
    ['Regime Fiscale Analyzer', '', 'none', undefined, undefined, 'template', 'Analysis and simulation of tax regimes (Forfettario, Semplificato, Ordinario, SRL).'],
    ['Contract Analyzer', '', 'none', undefined, undefined, 'template', 'Extraction of critical clauses from contracts and NDAs.'],
    ['GDPR Consent Manager', '', 'none', undefined, undefined, 'template', 'User consent management and privacy-compliant tracking.'],
    ['Copyright Validator', '', 'none', undefined, undefined, 'template', 'Pre-emptive copyright checks for text, image, and video assets.'],
    ['Prompt Firewall', '', 'none', undefined, undefined, 'template', 'Active defense against prompt injection and jailbreak attempts.'],
    ['PII Redactor', '', 'none', undefined, undefined, 'template', 'Automatic masking of personally identifiable information.'],
    ['License Auditor', '', 'none', undefined, undefined, 'template', 'Compliance checks on dependency licenses.'],
    ['Prior Art Search', '', 'none', undefined, undefined, 'template', 'Global patent database scans for originality checks.'],
    ['Claims Writer', '', 'none', undefined, undefined, 'template', 'Technical drafting of patent claims (USPTO/EUIPO).'],
    ['Trademark Guard', '', 'none', undefined, undefined, 'template', 'Domain, social, and trademark registry monitoring.'],
    ['Data Room Manager', '', 'none', undefined, undefined, 'template', 'Secure organization and access control for due diligence.'],
    ['Term Sheet Analyzer', '', 'none', undefined, undefined, 'template', 'Analysis and negotiation advisory for investment term sheets.'],
    ['Valuation Engine', '', 'none', undefined, undefined, 'template', 'DCF and market-multiples enterprise valuation.'],
    ['Saas Metrics Model', '', 'none', undefined, undefined, 'template', 'LTV/CAC, burn, runway, and forecast modeling.'],
  ]),

  ...build('HR & Operations', [
    ['CV Screener', '', 'none', undefined, undefined, 'template', 'Automated CV and portfolio evaluation against requirements.'],
    ['Interview Evaluator', '', 'none', undefined, undefined, 'template', 'Technical and behavioral question generation + scoring.'],
    ['Employee Handbook', '', 'none', undefined, undefined, 'template', 'Automated creation of onboarding guides.'],
    ['Workflow Orchestrator', '', 'none', undefined, undefined, 'template', 'Optimization of internal operational processes.'],
    ['Inventory Tracker', '', 'none', undefined, undefined, 'template', 'Real-time stock monitoring with predictive reordering.'],
    ['Vendor Optimizer', '', 'none', undefined, undefined, 'template', 'Comparative cost analysis of global suppliers.'],
    ['Fulfillment Bot', '', 'none', undefined, undefined, 'template', 'Shipment automation and delivery delay alerts.'],
    ['RFQ Generator', '', 'none', undefined, undefined, 'template', 'Automated Request for Quotation generation.'],
  ]),

  ...build('Product & Design', [
    ['UI Critique', '', 'none', undefined, undefined, 'template', 'Critique UI against UX heuristics.'],
    ['Design System', '', 'none', undefined, undefined, 'template', 'Tailwind/Radix-native component integration rules.'],
    ['Motion Skills', '', 'none', undefined, undefined, 'template', 'Scroll-driven animations and cinematic transitions.'],
    ['Typography Engine', '', 'none', undefined, undefined, 'template', 'Advanced typographic hierarchy and spacing.'],
    ['PRO Card Generator', '', 'none', undefined, undefined, 'template', 'Descriptive PRD generation.'],
    ['Backlog Groomer', '', 'none', undefined, undefined, 'template', 'Estimation and prioritization of backlogs.'],
    ['Feedback Synthesizer', '', 'none', undefined, undefined, 'template', 'Aggregation and structuring of user feedback.'],
    ['Roadmap Engine', '', 'none', undefined, undefined, 'template', 'Product roadmap aligned to milestones and resources.'],
  ]),

  ...build('Content & Growth', [
    ['SEO Audit', '', 'none', undefined, undefined, 'template', 'Technical SEO audits, keyword clustering, CRO fixes.'],
    ['Programmatic SEO', '', 'none', undefined, undefined, 'template', 'Scalable page generation from structured data.'],
    ['Google Search Console', '', 'oauth', 'Authorization', 'search-console', 'verified', 'Traffic, queries, and indexing issues.'],
    ['Editorial Calendar', '', 'none', undefined, undefined, 'template', 'Multi-platform calendars (X, LinkedIn, TikTok, IG).'],
    ['Viral Clipper', '', 'none', undefined, undefined, 'template', 'Long-form-to-vertical transformation rules.'],
    ['Humanizer', '', 'none', undefined, undefined, 'template', 'Strip robotic styling from copy.'],
    ['Ad Copy Engine', '', 'none', undefined, undefined, 'template', 'High-retention copy frameworks and psychology.'],
    ['Retention Analytics', '', 'none', undefined, undefined, 'template', 'Behavioral cohort and retention analysis.'],
    ['Press Pitch Engine', '', 'none', undefined, undefined, 'template', 'Customized pitch emails for journalists.'],
    ['Crisis Response', '', 'none', undefined, undefined, 'template', 'Communication strategies and official statements.'],
    ['Native Translator', '', 'none', undefined, undefined, 'template', 'Contextual translation covering slang and idioms.'],
    ['Hreflang Manager', '', 'none', undefined, undefined, 'template', 'International SEO multi-language tag management.'],
  ]),

  // ── Miscellaneous / Other integrations ───────────────────────────
  ...build('Other', [
    ['Zapier', '', 'apiKey', 'X-API-Key', 'zapier', 'verified', 'Trigger and execute 5,000+ app integrations.'],
    ['n8n', '', 'apiKey', 'X-N8N-API-KEY', 'n8n', 'verified', 'Workflow automation on self-hosted n8n.'],
    ['Make', '', 'bearer', 'Authorization', 'make', 'verified', 'Scenarios and integrations on Make (Integromat).'],
    ['IFTTT', '', 'apiKey', 'X-API-Key', 'ifttt', 'verified', 'Applet creation and triggers across services.'],
    ['DeepL', '', 'apiKey', 'Authorization', 'deepl', 'verified', 'High-accuracy translation API.'],
    ['Google Translate', '', 'apiKey', 'X-API-Key', 'google-translate', 'verified', 'Translation across Google-supported languages.'],
    ['OpenStreetMap', '', 'none', undefined, undefined, 'verified', 'Geocoding and map data queries.'],
    ['Google Maps', '', 'apiKey', 'X-API-Key', 'google-maps', 'verified', 'Places, geocoding, and directions.', 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps'],
    ['Mapbox', '', 'apiKey', 'Authorization', 'mapbox', 'verified', 'Geocoding, direction, and tiles on Mapbox.'],
  ]),
];

/** Every catalog entry with a real published endpoint convention. */
export const VERIFIED_CONNECTORS = MCP_CATALOG.filter(c => c.kind === 'verified');

/** PDF-referenced connectors awaiting a public endpoint. */
export const TEMPLATE_CONNECTORS = MCP_CATALOG.filter(c => c.kind === 'template');

export function findCatalogEntry(id: string): McpCatalogEntry | undefined {
  return MCP_CATALOG.find(c => c.id === id);
}

export function catalogByCategory(): Record<string, McpCatalogEntry[]> {
  const map: Record<string, McpCatalogEntry[]> = {};
  for (const c of MCP_CATALOG) {
    (map[c.category] ||= []).push(c);
  }
  return map;
}

export function catalogCount(): number {
  return MCP_CATALOG.length;
}