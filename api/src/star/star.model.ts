import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '@/user/user.model';
import { StarScore } from './star-score.model';
import type { MediaType } from '@/channel/channel.settings';

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

  // ID del canal (Channel.channelId) donde se dio la puntuación
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare channelId: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'movie',
  })
  declare mediaType: MediaType;

  // Nota global. Con categorías, es el promedio de las notas de StarScores
  @Column({
    type: DataType.DECIMAL(2, 1),
    allowNull: false,
  })
  declare score: number;

  // Ventana de votación (RatingSessions.id). null en los votos anteriores a las ventanas
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare sessionId: number | null;

  declare createdAt: Date;
  declare updatedAt: Date;

  @BelongsTo(() => User)
  declare user: User;

  @HasMany(() => StarScore)
  declare scores: StarScore[];
}
