import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';
import { CreateUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async createUser(userData: CreateUserDto) {
    return this.userModel.create(userData);
  }

  async getUserById(userId: number) {
    return this.userModel.findByPk(userId);
  }
}
