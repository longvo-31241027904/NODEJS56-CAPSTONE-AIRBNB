import { UserEnvelopeDto, SigninEnvelopeDto } from '../users/dto/response.dto';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { SignupDto, SigninDto } from '../users/dto/user.dto';
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly users: UsersService) {}
  @Post('signup')
  @HttpCode(201)
  @ApiOperation({ summary: 'Public signup; role is always USER, id is generated' })
  @ApiResponse({
    status: 201,
    type: UserEnvelopeDto,
    description: 'Success envelope with safe user; no password',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({
    status: 409,
    description: 'Email already registered, including concurrent signup',
  })
  signup(@Body() dto: SignupDto) {
    return this.users.create(dto);
  }
  @Post('signin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Public signin; 5 attempts per IP per 10 minutes; JWT expires in 1 hour',
  })
  @ApiResponse({
    status: 200,
    type: SigninEnvelopeDto,
    description: 'data: { token, user }; safe user only',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  signin(@Body() dto: SigninDto) {
    return this.users.signin(dto);
  }
}
