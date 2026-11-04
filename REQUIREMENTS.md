# Take-Home Assignment – Product Finder

**Position:** Senior Full-Stack Developer / Technical Lead \
**Deadline:** Monday, 09:00 (CET) \
**Expected effort:** Most people need roughly **6–8 hours**. There is no time limit, so work at your own pace over the weekend. What you build in that time is up to you: we prefer a smaller, well-reasoned solution over a broad but shallow one.

---

## 1. The Situation

We are a chemical company with a catalogue of specialty products used across industries such as personal care, coatings, agriculture and food. Product managers maintain the product data in a Product Information Management (PIM) system. Today, customers who want to know what we offer have to ask their sales contact, who then searches a spreadsheet.

We want to build a **Product Finder**: a web application where customers can explore our catalogue on their own, find the products that fit their needs, and share their experience with other customers through product reviews.

What we know so far:

- The PIM exports the catalogue as a CSV file every night. `data/products.csv` is an unmodified example of such an export.
- The catalogue has about 200 products today. Other business units will join over the next two years, and we expect it to grow to **around 50,000 products**.
- Customers often use the application on their phones, for example at trade fairs.
- Sales colleagues complain that customers regularly ask about products we no longer sell, because old spreadsheets still list them.
- Customers trust other customers' experience more than our marketing texts. The product reviews will be visible to everyone using the Product Finder.

---

## 2. What Users Need

| As a …          | I want to …                                            | so that …                                     |
| --------------- | ------------------------------------------------------ | --------------------------------------------- |
| Customer        | search the catalogue and narrow down the results       | I can quickly find products that fit my needs |
| Customer        | browse and sort through the results                    | I can compare the candidates                  |
| Customer        | see all relevant information about a product           | I can decide whether it's worth a closer look |
| Customer        | send a colleague a link to exactly what I'm looking at | we can discuss it together                    |
| Customer        | read reviews and ratings from other customers          | I can learn from their experience             |
| Customer        | write a review and rate a product                      | I can share my experience with others         |
| Product manager | have the Product Finder reflect the latest PIM export  | customers always see current data             |

---

## 3. Your Task

Act as the **technical lead** for this product. Design and build a first version of the Product Finder that you would be comfortable presenting to the business as a foundation to build on.

We deliberately don't specify the API, data model, UI or detailed behaviour. Deciding what goes into the first version, how it should work, and what to leave out is part of the assignment. Make decisions, prioritize, and explain your reasoning.

### Loading the data

The database must be populated from `data/products.csv` by a seed or import step that is part of your solution (for example a Prisma seed script or a CLI command). Document in your README how to run it.

- It must work on an **empty database** after the migrations have run.
- It must be **safe to run more than once**. Running it a second time must not create duplicate products or damage existing data.
- Data created by users of the application (such as reviews) must **survive re-running the seed**.

How and when the seed is triggered (manually, on startup, as part of Docker Compose, …) is up to you. We don't provide review data; if you want demo reviews, the same rules apply to them.

### Fixed constraints

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | Angular (latest stable), TypeScript, SCSS, PrimeNG |
| Backend  | Node.js, NestJS, TypeScript                        |
| Database | PostgreSQL with Prisma ORM                         |
| Testing  | Jest (frontend and backend)                        |
| Tooling  | Docker / Docker Compose, Git                       |

- We must be able to run the application locally by following your README.
- **Product reviews are the only write flow.** Comments, sample requests, contact forms, e-mail and moderation workflows are out of scope.
- User authentication is out of scope for this version.

---

## 4. Working with AI

We use AI coding agents such as GitHub Copilot in our daily work, and we encourage you to use them here too. We're not testing whether you can write code without AI. We're testing how well you **lead the work**: framing the problem, making design decisions, reviewing and correcting what the agent produces, and taking ownership of the result.

Generating code from this brief is easy. Turning it into a solution you can explain and defend is the actual job.

---

## 5. Deliverables

1. **Expectations:**
   - The application should be runnable in any environment that has correct dependecies setup
   - We are not grading the completeness of the project but the approach to solving it, please focus on the core features and good code quality/architecture choices
2. **README.md:** prerequisites and step-by-step instructions to run the application and the tests.
3. **DECISIONS.md** (1–3 pages):
   - An overview of your architecture
   - The most important decisions you made, the alternatives you considered, and why you chose as you did
   - The assumptions you made where the requirements were unclear
   - Risks and issues you identified, and how you addressed them (or would)
   - What you deliberately left out, and what you would do next to take this to production
4. **AI_USAGE.md** (about 1 page):
   - Which tools you used, and what you delegated to them vs. did yourself
   - At least two concrete examples where you rejected, corrected or significantly changed the agent's output, and why
5. **Database:** Do not send a database dump. We will start from an empty database and rebuild it using only your migrations, seed step and README instructions.

---

## 6. How We Evaluate

| Area                               | What we look at                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Problem understanding              | Did you understand the business problem, notice what isn't written down, and make sensible assumptions? |
| Solution design                    | Are your decisions appropriate for the situation, and well reasoned?                                    |
| Implementation quality             | Frontend, backend and data layer                                                                        |
| Testing                            | Do your tests give confidence in what matters?                                                          |
| Engineering setup                  | Is it easy to run and maintainable?                                                                     |
| Communication and AI collaboration | Clear documentation, honest trade-offs, and evidence that you steered the AI rather than followed it    |

---

## 7. Ground Rules and FAQ

- **Unclear requirements?** That's intentional. Make a reasonable assumption and write it down in DECISIONS.md.
- **Time:** There is no time limit. If you like, mention roughly how much time you spent.
- **Questions about logistics?** Contact: _[ mirela.andjelkovic@basf.com / karlo.skafec@basf.com ]_

**Next step:** In a follow-up interview, you'll walk us through your solution and decisions, and we'll extend it together.

Good luck, and have fun building it!
