import { userDoc } from "../admin.js";
import type { Proposal, ISODate, ProposalStatus } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("proposals");
}

export async function getProposal(uid: string, date: ISODate): Promise<Proposal | null> {
  const snap = await col(uid).doc(date).get();
  return snap.exists ? (snap.data() as Proposal) : null;
}

export async function writeProposal(uid: string, proposal: Proposal): Promise<void> {
  await col(uid).doc(proposal.date).set(proposal);
}

export async function setProposalStatus(
  uid: string,
  date: ISODate,
  status: ProposalStatus,
): Promise<void> {
  await col(uid).doc(date).update({ status });
}
