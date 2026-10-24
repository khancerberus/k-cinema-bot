import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { MediaType } from '@/channel/channel.settings';

@Table({
  timestamps: false,
})
export class CurrentMovie extends Model {
  // PK histórica: se rellena con el nombre del canal al crear la fila.
  // El código busca siempre por channelId, que no cambia si el canal se renombra
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    unique: true,
    primaryKey: true,
  })
  declare channelUsername: string;

  @Column({
    type: DataType.STRING(30),
    allowNull: true,
    unique: true,
  })
  declare channelId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare tmdbId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'movie',
  })
  declare mediaType: MediaType;
}
