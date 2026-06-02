import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  timestamps: true,
})
export class Recommendation extends Model {
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare userId: string;

  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare username: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
  })
  declare tmdbId: number;
}
