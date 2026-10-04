import Nav from "@/components/Nav";
import styles from "./page.module.css";
import { readFileSync } from "fs";
import path from "path";

function getInvoices() {
  try {
    const filePath = path.join(process.cwd(), "..", "data", "invoices.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Invoice Inbox | AI Task Worker",
};

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  const invoices = getInvoices();

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.header}>
            <div>
              <div className={styles.appLabel}>Simulated Company App</div>
              <h1 className={styles.title}>Invoice Inbox</h1>
              <p className={styles.subtitle}>{invoices.length} invoices on record</p>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table id="invoices-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Company</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} id={`invoice-${inv.id}`}>
                      <td className={styles.id}>{inv.id}</td>
                      <td className={styles.company}>{inv.company}</td>
                      <td className={styles.desc}>{inv.description}</td>
                      <td className={styles.amount}>${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td>{inv.due_date}</td>
                      <td className={styles.muted}>{inv.received_date}</td>
                      <td>
                        <span className={`badge badge-${inv.status === "processed" ? "processed" : "pending"}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
