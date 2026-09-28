# Agentify — AI Customer Support & Lead Generation Platform

Agentify helps businesses automate customer support and lead generation using intelligent AI agents. Built for businesses that may not have sophisticated digital infrastructure, enabling them to leverage AI without complexity.

---

## 🎯 What Agentify Does

### Core Features

- **Document Processing & RAG** – Ingest PDFs, Word documents, and text files to build AI knowledge bases
- **Smart Knowledge Base** – Store and retrieve business context for AI-powered responses
- **AI Customer Support Chatbot** – Answer customer questions with accurate, contextualized responses
- **Lead Generation Automation** – Identify and score leads, automate follow-up workflows
- **Email Integration** – Send automated emails and track engagement
- **Dashboard & Analytics** – Monitor customer interactions, track lead performance

---

## 🛠️ Technology Stack

| Layer | Technology |
|:---|:---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, TypeScript) |
| **UI Components** | React 19 + [shadcn/ui](https://ui.shadcn.com/) + Radix UI |
| **Styling** | [TailwindCSS 4](https://tailwindcss.com/) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + Auth) |
| **AI/LLM** | [Google Gemini API](https://ai.google.dev/) |
| **Document Processing** | Cheerio (web scraping) • pdf-parse (PDF extraction) • mammoth (Word docs) |
| **Email** | [Resend](https://resend.com/) + React Email |
| **Animation** | [Framer Motion](https://www.framer.com/motion/) |
| **Form Handling** | React Hook Form + Zod validation |
| **Charts & Data** | Recharts |
| **Testing** | Vitest + Playwright |

---

## 📁 Project Structure

```
agentify/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth flows (login, signup)
│   ├── (dashboard)/              # Protected dashboard pages
│   │   ├── knowledge-base/       # Document management & RAG
│   │   ├── support-chat/         # Customer support interface
│   │   ├── leads/                # Lead management & scoring
│   │   ├── emails/               # Email campaign management
│   │   └── analytics/            # Performance dashboard
│   ├── api/                      # API routes
│   │   ├── chat/                 # Chatbot API
│   │   ├── documents/            # Document processing
│   │   ├── leads/                # Lead management
│   │   └── email/                # Email sending
│   └── layout.tsx                # Root layout
├── components/                   # Reusable UI components
│   ├── ui/                       # shadcn/ui primitives
│   ├── dashboard/                # Dashboard-specific components
│   └── forms/                    # Form components
├── lib/                          # Utilities & helpers
│   ├── supabase/                 # Supabase client & queries
│   ├── ai/                       # Gemini API integration
│   ├── email/                    # Email templates
│   └── validators/               # Zod schemas
├── supabase/
│   ├── migrations/               # Database migrations
│   └── legacy_sql/               # Archived schema
├── tests/                        # Vitest + Playwright tests
└── package.json                  # Dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v18 or higher
- **npm/yarn/pnpm:** Package manager
- **Supabase Account:** For database and auth
- **Google Cloud Project:** With Gemini API enabled
- **Resend Account:** For email service (optional for local dev)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/musaabduljnr/agentify.git
   cd agentify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your credentials (see [Environment Variables](#environment-variables) below).

4. **Set up Supabase**
   ```bash
   npm install -g supabase
   supabase link --project-ref your-project-ref
   supabase db reset
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Google Gemini API (Server-side only)
GOOGLE_GENAI_API_KEY=your_gemini_api_key_here

# Resend Email Service (Server-side only)
RESEND_API_KEY=your_resend_api_key_here

# Environment
NODE_ENV=development
```

**Important Security Notes:**
- Never commit `.env.local` (see `.gitignore`)
- `NEXT_PUBLIC_*` variables are bundled into the client and are visible
- Keep `GOOGLE_GENAI_API_KEY` and `RESEND_API_KEY` server-side only
- Rotate these keys in production
- Use Supabase secrets for production deployments

See `.env.example` for a complete template.

---

## 📚 Key Features Explained

### 1. Document Processing & Knowledge Base

Upload documents (PDF, Word, text) to build a RAG knowledge base. The system:
- Extracts text from multiple formats
- Chunks content for efficient retrieval
- Stores embeddings in Supabase
- Retrieves context for AI responses

**Related files:**
- `app/api/documents/upload` – Upload handler
- `lib/ai/document-processor.ts` – Text extraction
- `lib/ai/embeddings.ts` – Vector storage

### 2. AI Chatbot

Customers interact with an AI-powered support chatbot that:
- Retrieves relevant context from your knowledge base
- Generates accurate, contextualized responses
- Maintains conversation history
- Handles fallback to human support

**Related files:**
- `app/api/chat/route.ts` – Chat API
- `lib/ai/gemini-client.ts` – Gemini integration

### 3. Lead Generation & Automation

Identify and nurture leads through:
- Automated lead scoring
- Email outreach campaigns
- Follow-up workflows
- Performance tracking

**Related files:**
- `app/(dashboard)/leads` – Lead management UI
- `app/api/leads` – Lead operations

---

## 🧪 Testing

### Run Tests

```bash
# Unit & integration tests
npm run test

# Coverage report
npm run test:coverage

# End-to-end tests
npm run test:e2e
```

---

## 🚀 Production Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

```bash
npm run build
npm run start
```

### Manual Deployment

```bash
# Build application
npm run build

# Test production build locally
npm run start

# Deploy to your hosting platform
```

---

## 📊 Database Schema

Agentify uses Supabase PostgreSQL with the following key tables:

- `users` – Authentication & profiles
- `documents` – Uploaded knowledge base documents
- `embeddings` – Vector embeddings for RAG
- `conversations` – Chat history
- `leads` – Lead records & scoring
- `email_campaigns` – Email templates & tracking

Run `supabase db reset` to apply all migrations.

---

## 🔄 Roadmap

- [ ] Multi-language support
- [ ] Custom domain setup for lead magnets
- [ ] Advanced lead scoring with machine learning
- [ ] SMS integrations
- [ ] Workflow automation builder
- [ ] Team collaboration & permissions
- [ ] API for third-party integrations

---

## 🤝 Contributing

This is a personal project. For feedback or collaboration inquiries, reach out directly.

---

## 📄 License

MIT License – See [LICENSE](LICENSE) file for details.

---

## 📞 Support

Questions? Issues? Reach out:
- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 🐛 Issues: [GitHub Issues](https://github.com/musaabduljnr/agentify/issues)

---

**Built with ❤️ using Next.js, Supabase, and Google Gemini API**
