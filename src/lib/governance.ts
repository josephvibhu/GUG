import { getDb, initDb, scheduleBlobPersist } from "./db";
import { getUserHolding } from "./market";
import { sendDiscordEmbed } from "./discord";

export interface CompanyMotion {
  id: string;
  companyId: string;
  ticker: string;
  title: string;
  description: string;
  createdBy: string;
  creatorName: string;
  status: "ACTIVE" | "PASSED" | "REJECTED" | "EXPIRED";
  quorumPct: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  yesShares: number;
  noShares: number;
  abstainShares: number;
  totalVotedShares: number;
  totalCompanyShares: number;
  votersCount: number;
  userVote?: "YES" | "NO" | "ABSTAIN";
  userEligibleShares?: number;
}

export async function getCompanyMotions(ticker: string, currentUserId?: string): Promise<{
  motions: CompanyMotion[];
  isFounder: boolean;
  userShares: number;
}> {
  await initDb();
  const db = getDb();
  const upperTicker = ticker.toUpperCase();

  const compRes = await db.execute({
    sql: "SELECT id, ticker, name, creator_id, total_shares FROM companies WHERE ticker = ?",
    args: [upperTicker],
  });

  if (compRes.rows.length === 0) {
    return { motions: [], isFounder: false, userShares: 0 };
  }

  const comp = compRes.rows[0];
  const companyId = String(comp.id);
  const totalCompanyShares = Number(comp.total_shares) || 10000;
  const isFounder = !!currentUserId && String(comp.creator_id) === String(currentUserId);

  let userShares = 0;
  if (currentUserId) {
    const holding = await getUserHolding(currentUserId, companyId);
    if (holding) {
      userShares = holding.shares;
    }
  }

  const motionsRes = await db.execute({
    sql: `SELECT * FROM company_motions WHERE company_id = ? ORDER BY created_at DESC`,
    args: [companyId],
  });

  const nowIso = new Date().toISOString();
  const motions: CompanyMotion[] = [];

  for (const row of motionsRes.rows) {
    const id = String(row.id);
    let status = String(row.status) as CompanyMotion["status"];
    const endsAt = String(row.ends_at);
    const quorumPct = Number(row.quorum_pct) || 10;

    // Get aggregated vote counts
    const votesRes = await db.execute({
      sql: `SELECT choice, SUM(shares_voted) as total_shares, COUNT(*) as voters_count 
            FROM company_motion_votes WHERE motion_id = ? GROUP BY choice`,
      args: [id],
    });

    let yesShares = 0;
    let noShares = 0;
    let abstainShares = 0;
    let votersCount = 0;

    for (const v of votesRes.rows) {
      const choice = String(v.choice);
      const sum = Number(v.total_shares) || 0;
      const count = Number(v.voters_count) || 0;
      votersCount += count;
      if (choice === "YES") yesShares = sum;
      else if (choice === "NO") noShares = sum;
      else if (choice === "ABSTAIN") abstainShares = sum;
    }

    const totalVotedShares = yesShares + noShares + abstainShares;

    // Check if motion has ended and auto-update status
    if (status === "ACTIVE" && nowIso > endsAt) {
      const quorumMet = (totalVotedShares / totalCompanyShares) >= (quorumPct / 100);
      if (quorumMet && yesShares > noShares) {
        status = "PASSED";
      } else if (quorumMet) {
        status = "REJECTED";
      } else {
        status = "EXPIRED"; // quorum not met
      }

      await db.execute({
        sql: "UPDATE company_motions SET status = ? WHERE id = ?",
        args: [status, id],
      });
      scheduleBlobPersist();
    }

    // Check current user's vote if logged in
    let userVote: "YES" | "NO" | "ABSTAIN" | undefined;
    if (currentUserId) {
      const userVoteRes = await db.execute({
        sql: "SELECT choice FROM company_motion_votes WHERE motion_id = ? AND user_id = ?",
        args: [id, currentUserId],
      });
      if (userVoteRes.rows.length > 0) {
        userVote = String(userVoteRes.rows[0].choice) as any;
      }
    }

    motions.push({
      id,
      companyId,
      ticker: upperTicker,
      title: String(row.title),
      description: String(row.description),
      createdBy: String(row.created_by),
      creatorName: String(row.creator_name),
      status,
      quorumPct,
      startsAt: String(row.starts_at),
      endsAt,
      createdAt: String(row.created_at),
      yesShares,
      noShares,
      abstainShares,
      totalVotedShares,
      totalCompanyShares,
      votersCount,
      userVote,
      userEligibleShares: userShares,
    });
  }

  return { motions, isFounder, userShares };
}

export async function createCompanyMotion(params: {
  ticker: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  quorumPct?: number;
  durationDays?: number;
}): Promise<{ success: boolean; motionId?: string; error?: string }> {
  await initDb();
  const db = getDb();
  const upperTicker = params.ticker.toUpperCase();

  const compRes = await db.execute({
    sql: "SELECT id, ticker, name, creator_id FROM companies WHERE ticker = ?",
    args: [upperTicker],
  });

  if (compRes.rows.length === 0) {
    return { success: false, error: "Company not found" };
  }

  const comp = compRes.rows[0];
  const companyId = String(comp.id);
  const companyName = String(comp.name);

  // Check if caller is founder or manager
  const userRes = await db.execute({
    sql: "SELECT is_admin FROM users WHERE id = ?",
    args: [params.userId],
  });
  const isAdmin = userRes.rows.length > 0 && Number(userRes.rows[0].is_admin) === 1;

  if (String(comp.creator_id) !== String(params.userId) && !isAdmin) {
    return { success: false, error: "Only the company founder or exchange operator can propose proxy motions." };
  }

  const title = params.title.trim();
  const description = params.description.trim();

  if (title.length < 5 || title.length > 120) {
    return { success: false, error: "Title must be between 5 and 120 characters." };
  }
  if (description.length < 10 || description.length > 2000) {
    return { success: false, error: "Description must be between 10 and 2000 characters." };
  }

  const quorumPct = Math.max(5, Math.min(50, Number(params.quorumPct) || 10));
  const days = Math.max(1, Math.min(14, Number(params.durationDays) || 3));

  const motionId = "mot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const now = new Date();
  const startsAt = now.toISOString();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: `INSERT INTO company_motions 
          (id, company_id, ticker, title, description, created_by, creator_name, status, quorum_pct, starts_at, ends_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
    args: [
      motionId,
      companyId,
      upperTicker,
      title,
      description,
      params.userId,
      params.userName,
      quorumPct,
      startsAt,
      endsAt,
      startsAt,
    ],
  });

  scheduleBlobPersist();

  // Send Discord Alert for the newly proposed motion
  sendDiscordEmbed({
    title: `📜 SHAREHOLDER MOTION PROPOSED: $${upperTicker}`,
    description: `Founder **@${params.userName}** has put forward a new shareholder resolution for **${companyName}**!`,
    color: 0x8b5cf6, // Violet
    url: `https://growurgold.vercel.app/trade/${upperTicker}`,
    fields: [
      { name: "Motion Title", value: `**${title}**`, inline: false },
      { name: "Summary", value: description.length > 250 ? description.slice(0, 247) + "..." : description, inline: false },
      { name: "Quorum Required", value: `${quorumPct}% of total shares`, inline: true },
      { name: "Voting Closes", value: `<t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>`, inline: true },
    ],
    footerText: "Parlamentum Shareholder Proxy Governance",
  }).catch((err) => console.warn("Failed to notify discord about motion:", err));

  return { success: true, motionId };
}

export async function castMotionVote(params: {
  motionId: string;
  userId: string;
  userName: string;
  choice: "YES" | "NO" | "ABSTAIN";
}): Promise<{ success: boolean; sharesVoted?: number; error?: string }> {
  await initDb();
  const db = getDb();

  const motionRes = await db.execute({
    sql: "SELECT * FROM company_motions WHERE id = ?",
    args: [params.motionId],
  });

  if (motionRes.rows.length === 0) {
    return { success: false, error: "Motion not found" };
  }

  const motion = motionRes.rows[0];
  const companyId = String(motion.company_id);
  const status = String(motion.status);
  const endsAt = String(motion.ends_at);

  if (status !== "ACTIVE" || new Date().toISOString() > endsAt) {
    return { success: false, error: "Voting for this motion has concluded." };
  }

  // Get user's current shares
  const holding = await getUserHolding(params.userId, companyId);
  const shares = holding ? holding.shares : 0;

  if (shares <= 0) {
    return { success: false, error: "You must hold at least 1 share of this company to vote." };
  }

  const voteId = "vote_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const nowIso = new Date().toISOString();

  await db.execute({
    sql: `INSERT OR REPLACE INTO company_motion_votes 
          (id, motion_id, user_id, voter_name, choice, shares_voted, voted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      voteId,
      params.motionId,
      params.userId,
      params.userName,
      params.choice,
      shares,
      nowIso,
    ],
  });

  scheduleBlobPersist();

  return { success: true, sharesVoted: shares };
}
