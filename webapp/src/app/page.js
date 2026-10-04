import Nav from "@/components/Nav";
import styles from "./page.module.css";

export const metadata = {
  title: "AI Task Worker",
  description: "Autonomous AI task execution prototype",
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.hero}>
            <div className={styles.heroLabel}>AI Engineering Intern Assessment</div>
            <h1 className={styles.heroTitle}>Autonomous AI Task Worker</h1>
            <p className={styles.heroDesc}>
              A prototype system that accepts natural language tasks and executes them
              autonomously using LLM reasoning, browser automation, and tool use.
            </p>
            <div className={styles.heroCtas}>
              <a href="/dashboard" className="btn btn-primary">Open Dashboard</a>
              <a href="/app/invoices" className="btn btn-ghost">View Invoice Inbox</a>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>01</div>
              <h3>Natural Language Input</h3>
              <p>Submit any invoice-related task in plain English. The agent understands the goal, not just the steps.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>02</div>
              <h3>Tool-Driven Execution</h3>
              <p>The agent uses browser automation, file tools, and API calls to take real actions, not simulated ones.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>03</div>
              <h3>Failure Recovery</h3>
              <p>When actions fail, the agent detects the error, retries or chooses an alternative approach.</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>04</div>
              <h3>Verified Completion</h3>
              <p>After execution, the agent confirms the outcome was achieved and returns a summary with evidence.</p>
            </div>
          </div>

          <div className={styles.example}>
            <div className={styles.exampleLabel}>Example Task</div>
            <p className={styles.exampleText}>
              &ldquo;Find the latest invoice from Acme Corp, extract the amount and due date,
              enter it into our internal system, and tell me once it is done.&rdquo;
            </p>
          </div>

          <div className={styles.stack}>
            <span className={styles.stackItem}>Google Gemini 2.0</span>
            <span className={styles.stackDivider}>/</span>
            <span className={styles.stackItem}>Playwright</span>
            <span className={styles.stackDivider}>/</span>
            <span className={styles.stackItem}>FastAPI</span>
            <span className={styles.stackDivider}>/</span>
            <span className={styles.stackItem}>Next.js</span>
            <span className={styles.stackDivider}>/</span>
            <span className={styles.stackItem}>Python 3.11</span>
          </div>
        </div>
      </main>
    </>
  );
}
