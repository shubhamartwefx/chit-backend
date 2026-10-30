import { Types } from 'mongoose';
import {
  accessDenied,
  badRequest,
  notFound,
} from '../../common/errors';
import { USER_ROLES, USER_STATUS } from '../../config/roles';
import { JwtPayload } from '../../types/express';
import { CHIT_STATUS, Chit } from '../chits/chit.model';
import { blockUserAccount } from '../users/account-block.service';
import { User } from '../users/user.model';
import {
  AGENT_AUTO_BLOCK_UNIQUE_REPORTERS,
  AgentReport,
  AgentReportReason,
} from './agent-report.model';
import type { ListAgentReportsQueryInput } from './agent-report.validation';

export const AGENT_REPORT_BLOCK_REASON =
  `Account blocked after ${AGENT_AUTO_BLOCK_UNIQUE_REPORTERS} unique bidder reports. Contact support to unblock.`;

function formatReportDto(
  r: {
    _id: Types.ObjectId;
    agentId: Types.ObjectId;
    reporterId: Types.ObjectId;
    chitId: Types.ObjectId;
    reason: AgentReportReason;
    note?: string | null;
    createdAt: Date;
    updatedAt?: Date;
  },
  extras: {
    agentName?: string | null;
    agentStatus?: string | null;
    reporterName?: string | null;
    reporterPhone?: string | null;
    chitCode?: string | null;
  } = {}
) {
  return {
    id: r._id.toString(),
    agentId: r.agentId.toString(),
    agentName: extras.agentName ?? 'Agent',
    agentStatus: extras.agentStatus ?? null,
    reporterId: r.reporterId.toString(),
    reporterName: extras.reporterName ?? 'Bidder',
    reporterPhone: extras.reporterPhone ?? null,
    chitId: r.chitId.toString(),
    chitCode: extras.chitCode ?? null,
    reason: r.reason,
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  };
}

export class AgentReportService {
  /**
   * Bidder reports the agent who owns a chit they are enrolled in.
   * Multiple reports per chit are allowed. Auto-blocks after unique reporters
   * reach the threshold.
   */
  async reportAgentOnChit(
    actor: JwtPayload,
    chitId: string,
    input: { reason: AgentReportReason; note?: string }
  ) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw accessDenied('Only bidders can report an agent');
    }

    const chit = await Chit.findOne({
      _id: new Types.ObjectId(chitId),
      status: { $ne: CHIT_STATUS.DELETED },
    });
    if (!chit) {
      throw notFound('Chit not found');
    }

    const enrolled = chit.members.some(
      (m) => m.bidderId.toString() === actor.sub
    );
    if (!enrolled) {
      throw accessDenied(
        'You can only report the agent of a chit you are enrolled in'
      );
    }

    if (!chit.agentId) {
      throw badRequest('This chit has no agent to report');
    }

    const agentId = chit.agentId.toString();
    const agent = await User.findOne({
      _id: chit.agentId,
      role: USER_ROLES.AGENT,
    })
      .select('_id status name')
      .lean();

    if (!agent) {
      throw notFound('Agent not found for this chit');
    }

    if (agent.status === USER_STATUS.BLOCKED) {
      throw badRequest('This agent is already blocked');
    }

    const report = await AgentReport.create({
      agentId: chit.agentId,
      reporterId: new Types.ObjectId(actor.sub),
      chitId: chit._id,
      reason: input.reason,
      note: input.note?.trim() ? input.note.trim() : null,
    });

    const uniqueReporterCount = await AgentReport.distinct('reporterId', {
      agentId: chit.agentId,
    }).then((ids) => ids.length);

    let agentBlocked = false;
    if (uniqueReporterCount >= AGENT_AUTO_BLOCK_UNIQUE_REPORTERS) {
      const result = await blockUserAccount({
        userId: agentId,
        actorId: actor.sub,
        reason: AGENT_REPORT_BLOCK_REASON,
      });
      agentBlocked = result.blocked;
    }

    return {
      ...formatReportDto(report, {
        agentName: agent.name ?? 'Agent',
        agentStatus: agent.status,
        chitCode: chit.chitCode ?? null,
      }),
      uniqueReporterCount,
      threshold: AGENT_AUTO_BLOCK_UNIQUE_REPORTERS,
      agentBlocked,
    };
  }

  /** Reports the signed-in bidder has filed against agents. */
  async listMyAgentReports(actor: JwtPayload) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw accessDenied('Only bidders can list agent reports they filed');
    }

    const reports = await AgentReport.find({
      reporterId: new Types.ObjectId(actor.sub),
    })
      .sort({ createdAt: -1 })
      .lean();

    return {
      total: reports.length,
      items: await this.enrichReports(reports),
    };
  }

  /** Reports filed against the signed-in agent by any bidder. */
  async listReportsAgainstAgent(
    actor: JwtPayload,
    query: ListAgentReportsQueryInput
  ) {
    if (actor.role !== USER_ROLES.AGENT) {
      throw accessDenied('Only agents can list reports filed against them');
    }

    const filter: Record<string, unknown> = {
      agentId: new Types.ObjectId(actor.sub),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    let reports = await AgentReport.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const items = await this.enrichReports(reports);

    const q = query.q?.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (item) =>
            item.reporterName.toLowerCase().includes(q) ||
            item.reporterId.toLowerCase().includes(q) ||
            (item.reporterPhone && item.reporterPhone.includes(q)) ||
            (item.chitCode && item.chitCode.toLowerCase().includes(q)) ||
            item.reason.toLowerCase().includes(q)
        )
      : items;

    const total = filtered.length;
    const paged = filtered.slice(skip, skip + limit);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async updateMyAgentReport(
    actor: JwtPayload,
    reportId: string,
    input: { reason: AgentReportReason; note?: string }
  ) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw accessDenied('Only bidders can update their agent reports');
    }

    const report = await AgentReport.findOne({
      _id: new Types.ObjectId(reportId),
      reporterId: new Types.ObjectId(actor.sub),
    });
    if (!report) {
      throw notFound('Report not found');
    }

    report.reason = input.reason;
    report.note = input.note?.trim() ? input.note.trim() : null;
    await report.save();

    const [enriched] = await this.enrichReports([report.toObject()]);
    return enriched;
  }

  async deleteMyAgentReport(actor: JwtPayload, reportId: string) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw accessDenied('Only bidders can delete their agent reports');
    }

    const report = await AgentReport.findOneAndDelete({
      _id: new Types.ObjectId(reportId),
      reporterId: new Types.ObjectId(actor.sub),
    });
    if (!report) {
      throw notFound('Report not found');
    }

    return {
      id: report._id.toString(),
      deleted: true,
    };
  }

  private async enrichReports(
    reports: Array<{
      _id: Types.ObjectId;
      agentId: Types.ObjectId;
      reporterId: Types.ObjectId;
      chitId: Types.ObjectId;
      reason: AgentReportReason;
      note?: string | null;
      createdAt: Date;
      updatedAt?: Date;
    }>
  ) {
    if (reports.length === 0) return [];

    const agentIds = [...new Set(reports.map((r) => r.agentId.toString()))];
    const reporterIds = [
      ...new Set(reports.map((r) => r.reporterId.toString())),
    ];
    const chitIds = [...new Set(reports.map((r) => r.chitId.toString()))];

    const [agents, reporters, chits] = await Promise.all([
      User.find({
        _id: { $in: agentIds.map((id) => new Types.ObjectId(id)) },
        role: USER_ROLES.AGENT,
      })
        .select('name phone status')
        .lean(),
      User.find({
        _id: { $in: reporterIds.map((id) => new Types.ObjectId(id)) },
        role: USER_ROLES.BIDDER,
      })
        .select('name phone')
        .lean(),
      Chit.find({
        _id: { $in: chitIds.map((id) => new Types.ObjectId(id)) },
      })
        .select('chitCode')
        .lean(),
    ]);

    const agentMap = new Map(
      agents.map((a) => [
        a._id.toString(),
        { name: a.name ?? 'Agent', status: a.status },
      ])
    );
    const reporterMap = new Map(
      reporters.map((u) => [
        u._id.toString(),
        { name: u.name ?? 'Bidder', phone: u.phone ?? null },
      ])
    );
    const chitMap = new Map(
      chits.map((c) => [c._id.toString(), c.chitCode ?? null])
    );

    return reports.map((r) => {
      const agent = agentMap.get(r.agentId.toString());
      const reporter = reporterMap.get(r.reporterId.toString());
      return formatReportDto(r, {
        agentName: agent?.name,
        agentStatus: agent?.status ?? null,
        reporterName: reporter?.name,
        reporterPhone: reporter?.phone ?? null,
        chitCode: chitMap.get(r.chitId.toString()) ?? null,
      });
    });
  }
}

export const agentReportService = new AgentReportService();
