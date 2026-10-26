import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
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

  async getAll() {
    return this.userModel.findAll();
  }

  async getUserById(userId: number) {
    return this.userModel.findByPk(userId);
  }

  // Sin distinguir mayúsculas: en el chat se escribe @usuario como sea
  async getByUsername(username: string) {
    return this.userModel.findOne({
      where: Sequelize.where(
        Sequelize.fn('lower', Sequelize.col('username')),
        username.toLowerCase(),
      ),
    });
  }

  // Usuario del chat: se crea la primera vez y se actualiza su nombre si cambió en Twitch
  async findOrCreate(userId: number, username: string) {
    const user = await this.getUserById(userId);
    if (!user) return this.createUser({ userId, username });
    if (user.username !== username) {
      user.username = username;
      await user.save();
    }
    return user;
  }
}
