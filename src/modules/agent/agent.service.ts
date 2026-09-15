import { operatorBidderService } from '../operator-bidders/operator-bidder.service';
import {
  CreateOperatorBidderInput,
  ListOperatorBiddersQueryInput,
  OperatorBidderStatusActionInput,
} from '../operator-bidders/operator-bidder.validation';
import { USER_ROLES } from '../../config/roles';

export class AgentService {
  async listBidders(agentId: string, query: ListOperatorBiddersQueryInput) {
    return operatorBidderService.list(agentId, USER_ROLES.AGENT, query);
  }

  async createBidder(agentId: string, input: CreateOperatorBidderInput) {
    return operatorBidderService.create(agentId, input);
  }

  async blockBidder(
    agentId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    return operatorBidderService.blockBidder(agentId, bidderId, input);
  }

  async unblockBidder(
    agentId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    return operatorBidderService.unblockBidder(agentId, bidderId, input);
  }
}

export const agentService = new AgentService();
