import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { Star } from '@/star/star.model';

@Table({
  timestamps: true,
})
export class User extends Model {
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
  })
  declare userId: number;

  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare username: string;

  declare createdAt: Date;
  declare updatedAt: Date;

  @HasMany(() => Star)
  declare stars: Star[];
}
