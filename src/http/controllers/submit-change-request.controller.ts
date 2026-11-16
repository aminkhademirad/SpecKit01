import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { SubmitChangeRequest } from '../../application/submit-change-request';
import type { AuthenticatedRequest } from '../guards/authentication.guard';
import { DeferredJsonBody, ParseJsonBodyPipe } from '../pipes/parse-json-body.pipe';
import { decodeIfMatch } from '../etag';

@Controller('api/change-requests')
export class SubmitChangeRequestController {
  constructor(@Inject(SubmitChangeRequest) private readonly submitRequest: SubmitChangeRequest) {}

  @Post(':id/submit')
  @HttpCode(204)
  submit(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody): void {
    this.submitRequest.execute(request.identity!, id, () => body.unwrap(), () => decodeIfMatch(request.headers['if-match']));
  }
}
