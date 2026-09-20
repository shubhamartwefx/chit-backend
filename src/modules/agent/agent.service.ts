import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import {
  CreateOperatorBidderInput,
  ListOperatorBiddersQueryInput,
  OperatorBidderStatusActionInput,
  UpdateOperatorBidderInput,
} from '../operator-bidders/operator-bidder.validation';
import { USER_ROLES } from '../../config/roles';

export class AgentService {
  async listBidders(agentId: string, query: ListOperatorBiddersQueryInput) {
    return operatorBidderService.list(agentId, USER_ROLES.AGENT, query);
  }

  async createBidder(agentId: string, input: CreateOperatorBidderInput) {
    return operatorBidderService.create(agentId, input);
  }

  async updateBidder(
    agentId: string,
    bidderId: string,
    input: UpdateOperatorBidderInput
  ) {
    return operatorBidderService.updateBidder(
      agentId,
      USER_ROLES.AGENT,
      bidderId,
      input
    );
  }

  async blockBidder(
    agentId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    return operatorBidderService.blockBidder(
      agentId,
      USER_ROLES.AGENT,
      bidderId,
      input
    );
  }

  async unblockBidder(
    agentId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    return operatorBidderService.unblockBidder(
      agentId,
      USER_ROLES.AGENT,
      bidderId,
      input
    );
  }

  async listBidderReports(agentId: string, bidderId: string) {
    return operatorBidderService.listBidderReports(
      agentId,
      USER_ROLES.AGENT,
      bidderId
    );
  }
}

export const agentService = new AgentService();
