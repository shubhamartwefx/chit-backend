import { Types } from 'mongoose';
import { isValidIndianPhone } from '../../common/crypto';
import { accessDenied, badRequest } from '../../common/errors';
import { JwtPayload } from '../../types/express';
import { USER_ROLES, UserRole } from '../../config/roles';
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import { User } from '../users/user.model';
import {
  DirectoryRole,
  DirectorySearchQueryInput,
} from './directory.validation';

const MAX_RESULTS = 10;
const INDIA_DIAL_PREFIX = '91';

const SEARCHABLE_ROLES: Partial<Record<UserRole, readonly DirectoryRole[]>> = {
  [USER_ROLES.AGENT]: [USER_ROLES.BIDDER],
  [USER_ROLES.BIDDER]: [USER_ROLES.AGENT],
  [USER_ROLES.BRANCH_STORE]: [USER_ROLES.BIDDER, USER_ROLES.AGENT],
};

const DISPLAY_ID_PREFIX_ROLE: Record<string, DirectoryRole> = {
  BD: USER_ROLES.BIDDER,
  AG: USER_ROLES.AGENT,
};

export const DIRECTORY_QUERY_HINT =
  'Enter a 10-digit phone number or an ID like BD-1A2B-3C4D';

type Lookup =
  | { kind: 'objectId'; id: Types.ObjectId }
  | { kind: 'phone'; phone: string }
  | { kind: 'displayId'; suffix: string; role: DirectoryRole | null };

/**
 * Only exact identifiers are accepted so the directory can't be used to
 * browse users platform-wide. Display ids are the UI codes from
 * `formatEntityCode` on the frontend: `PREFIX-XXXX-XXXX`, the last 8 hex
 * characters of the Mongo id.
 */
function parseLookup(rawQuery: string): Lookup {
  const q = rawQuery.trim();

  if (/^[a-fA-F0-9]{24}$/.test(q)) {
    return { kind: 'objectId', id: new Types.ObjectId(q) };
  }

  if (/^[+\d\s-]+$/.test(q)) {
    let digits = q.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith(INDIA_DIAL_PREFIX)) {
      digits = digits.slice(INDIA_DIAL_PREFIX.length);
    }
    if (isValidIndianPhone(digits)) {
      return { kind: 'phone', phone: digits };
    }
  }

  const displayId = /^(?:(AG|BD)-?)?([a-f0-9]{4})-?([a-f0-9]{4})$/i.exec(q);
  if (displayId) {
    const [, prefix, head, tail] = displayId;
    return {
      kind: 'displayId',
      suffix: `${head}${tail}`.toLowerCase(),
      role: prefix ? DISPLAY_ID_PREFIX_ROLE[prefix.toUpperCase()] : null,
    };
  }

  throw badRequest(DIRECTORY_QUERY_HINT);
}

function lookupFilter(lookup: Lookup): Record<string, unknown> {
  switch (lookup.kind) {
    case 'objectId':
      return { _id: lookup.id };
    case 'phone':
      return { phone: lookup.phone };
    case 'displayId':
      return {
        $expr: {
          $regexMatch: { input: { $toString: '$_id' }, regex: `${lookup.suffix}$` },
        },
      };
  }
}

async function countPlatformReports(
  bidderIds: Types.ObjectId[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (bidderIds.length === 0) return counts;

  const rows = await Chit.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        status: { $ne: CHIT_STATUS.DELETED },
        'members.bidderId': { $in: bidderIds },
      },
    },
    { $unwind: '$members' },
    { $match: { 'members.bidderId': { $in: bidderIds } } },
    {
      $group: {
        _id: '$members.bidderId',
        count: { $sum: { $size: { $ifNull: ['$members.reports', []] } } },
      },
    },
  ]);
  for (const row of rows) counts.set(row._id.toString(), row.count);
  return counts;
}

export class DirectoryService {
  allowedRoles(actorRole: UserRole): readonly DirectoryRole[] {
    return SEARCHABLE_ROLES[actorRole] ?? [];
  }

  async search(actor: JwtPayload, query: DirectorySearchQueryInput) {
    const allowed = this.allowedRoles(actor.role);
    if (allowed.length === 0) {
      throw accessDenied('Directory search is not available for this role');
    }
    if (query.role && !allowed.includes(query.role)) {
      throw accessDenied(`You cannot search ${query.role}s`);
    }

    const lookup = parseLookup(query.q);
    let roles: readonly DirectoryRole[] = query.role ? [query.role] : allowed;
    if (lookup.kind === 'displayId' && lookup.role) {
      roles = roles.filter((role) => role === lookup.role);
    }
    if (roles.length === 0) {
      return { items: [] };
    }

    const users = await User.find({
      $and: [
        { role: { $in: roles } },
        { _id: { $ne: new Types.ObjectId(actor.sub) } },
        lookupFilter(lookup),
      ],
    })
      .select('name phone countryCode role status')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();

    const bidderIds = users
      .filter((user) => user.role === USER_ROLES.BIDDER)
      .map((user) => user._id as Types.ObjectId);
    const reportCounts = await countPlatformReports(bidderIds);

    return {
      items: users.map((user) => {
        const id = String(user._id);
        return {
          id,
          name: user.name,
          phone: user.phone,
          countryCode: user.countryCode,
          role: user.role as DirectoryRole,
          status: user.status,
          ...(user.role === USER_ROLES.BIDDER
            ? { reportCount: reportCounts.get(id) ?? 0 }
            : {}),
        };
      }),
    };
  }

  /** Platform-wide reports on a bidder; reporter identity stays internal. */
  async listBidderReports(actor: JwtPayload, bidderId: string) {
    if (!this.allowedRoles(actor.role).includes(USER_ROLES.BIDDER)) {
      throw accessDenied('You cannot view bidder reports');
    }
    const { total, items } =
      await operatorBidderService.listBidderReportsPlatform(bidderId);
    return {
      bidderId,
      total,
      items: items.map(({ reason, note, chitCode, createdAt }) => ({
        reason,
        note,
        chitCode,
        createdAt,
      })),
    };
  }
}

export const directoryService = new DirectoryService();
