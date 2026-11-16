import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { ApproveChangeRequest } from '../../application/approve-change-request';
import { RequestChanges } from '../../application/request-changes';
import type { AuthenticatedRequest } from '../guards/authentication.guard';
import { DeferredJsonBody, ParseJsonBodyPipe } from '../pipes/parse-json-body.pipe';
import { decodeIfMatch } from '../etag';

@Controller('api/change-requests')
export class ReviewChangeRequestController {
  constructor(
    @Inject(ApproveChangeRequest) private readonly approveRequest: ApproveChangeRequest,
    @Inject(RequestChanges) private readonly returnRequest: RequestChanges,
  ) {}

  @Post(':id/approve')
  @HttpCode(204)
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody): void {
    this.approveRequest.execute(request.identity!, id, () => body.unwrap(), () => decodeIfMatch(request.headers['if-match']));
  }

  @Post(':id/request-changes')
  @HttpCode(204)
  requestChanges(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody): void {
    this.returnRequest.execute(request.identity!, id, () => body.unwrap(), () => decodeIfMatch(request.headers['if-match']));
  }
}
