import { Body, Controller, Get, Inject, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import type { ChangeRequest } from '../../domain/change-request';
import { CreateChangeRequest } from '../../application/create-change-request';
import { GetChangeRequest } from '../../application/get-change-request';
import { UpdateChangeRequest } from '../../application/update-change-request';
import type { AuthenticatedRequest } from '../guards/authentication.guard';
import { DeferredJsonBody, ParseJsonBodyPipe } from '../pipes/parse-json-body.pipe';
import { writeChangeRequestInput } from '../inputs/write-change-request.input';
import { decodeIfMatch, encodeEtag } from '../etag';

function representation(row: ChangeRequest) {
  const { id, title, description, reason, requesterId, status } = row;
  return { id, title, description, reason, requesterId, status };
}

@Controller('api/change-requests')
export class ChangeRequestsController {
  constructor(
    @Inject(CreateChangeRequest) private readonly createRequest: CreateChangeRequest,
    @Inject(GetChangeRequest) private readonly getRequest: GetChangeRequest,
    @Inject(UpdateChangeRequest) private readonly updateRequest: UpdateChangeRequest,
  ) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody, @Res({ passthrough: true }) response: ServerResponse) {
    const row = this.createRequest.execute(request.identity!, writeChangeRequestInput(body));
    response.setHeader('Location', `/api/change-requests/${row.id}`);
    response.setHeader('ETag', encodeEtag(row));
    return representation(row);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res({ passthrough: true }) response: ServerResponse) {
    const row = this.getRequest.execute(request.identity!, id);
    response.setHeader('ETag', encodeEtag(row));
    return representation(row);
  }

  @Put(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body(new ParseJsonBodyPipe()) body: DeferredJsonBody, @Res({ passthrough: true }) response: ServerResponse) {
    const row = this.updateRequest.execute(request.identity!, id, writeChangeRequestInput(body), () => decodeIfMatch(request.headers['if-match']));
    response.setHeader('ETag', encodeEtag(row));
    return representation(row);
  }
}
