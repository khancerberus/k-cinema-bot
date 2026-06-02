import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  timestamps: false,
})
export class CurrentMovie extends Model {
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    unique: true,
    primaryKey: true,
  })
  declare channelUsername: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare tmdbId: number;
}
