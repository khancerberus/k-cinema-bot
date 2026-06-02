import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@/user/user.model';

@Table({
  timestamps: true,
})
export class Star extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare tmdbId: number;

  @Column({
    type: DataType.DECIMAL(2, 1),
    allowNull: false,
  })
  declare score: number;

  declare createdAt: Date;
  declare updatedAt: Date;

  @BelongsTo(() => User)
  declare user: User;
}
