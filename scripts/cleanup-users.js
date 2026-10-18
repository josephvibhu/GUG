const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:parlamentum_market.db' });
const passHash = '$2b$10$xRYixtfhwn2eJesmqVhZFOUGQVZLjjqza9XfR7A4EcwCHgjL53EWe';
const now = new Date().toISOString();

async function run() {
  await client.execute('PRAGMA foreign_keys = OFF;');

  // 1. Create or update JosephArora
  await client.execute({
    sql: `INSERT OR REPLACE INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
          VALUES ('usr_josepharora', 'JosephArora', ?, 'Joseph Arora', 'JosephArora', 0.0, 0.0, '🏛️', 1, ?)`,
    args: [passHash, now]
  });

  // 2. Reassign companies, orders, announcements to usr_josepharora
  await client.execute(`UPDATE companies SET creator_id = 'usr_josepharora';`);
  await client.execute(`UPDATE announcements SET author_id = 'usr_josepharora';`);
  await client.execute(`UPDATE orders SET user_id = 'usr_josepharora' WHERE user_id IN ('usr_house', 'usr_treasury');`);

  // 3. Recreate portfolio for JosephArora (10,000 total shares: 9,000 free, 1,000 locked in float sell order)
  await client.execute(`DELETE FROM portfolios WHERE user_id IN ('usr_house', 'usr_treasury');`);
  await client.execute(`
    INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
    VALUES ('port_usr_josepharora_GUG', 'usr_josepharora', 'cmp_gug_001', 10000, 1000, 3.0);
  `);

  // 4. Delete all other users and their data except CardinalSanjay and JosephArora
  await client.execute(`
    DELETE FROM wallet_transactions WHERE user_id NOT IN (
      SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
    );
  `);
  await client.execute(`
    DELETE FROM orders WHERE user_id NOT IN (
      SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
    );
  `);
  await client.execute(`
    DELETE FROM portfolios WHERE user_id NOT IN (
      SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
    );
  `);
  await client.execute(`
    DELETE FROM users WHERE LOWER(username) NOT IN ('cardinalsanjay', 'josepharora');
  `);

  const remaining = await client.execute('SELECT id, username, display_name, is_admin, cash_balance FROM users');
  console.log('Remaining Users in DB:', JSON.stringify(remaining.rows, null, 2));

  const ports = await client.execute('SELECT p.*, u.username FROM portfolios p JOIN users u ON p.user_id = u.id');
  console.log('Portfolios:', JSON.stringify(ports.rows, null, 2));
}

run().catch(console.error);
