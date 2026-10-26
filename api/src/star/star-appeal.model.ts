import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Star } from './star.model';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

// Petición de corregir un voto (!apelar). Si un mod la aprueba, el voto se sobrescribe con estas notas
@Table({
  timestamps: true,
  indexes: [
    { name: 'star_appeals_channel_id_status', fields: ['channelId', 'status'] },
  ],
})
export class StarAppeal extends Model {
  @ForeignKey(() => Star)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare starId: number;

  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare channelId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare sessionId: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  // Nota global pedida (promedio de las categorías)
  @Column({
    type: DataType.DECIMAL(2, 1),
    allowNull: false,
  })
  declare score: number;

  // categoryKey → nota pedida. Vacío si se vota sin categorías
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  declare scores: Record<string, number>;

  @Column({
    type: DataType.STRING(200),
    allowNull: false,
    defaultValue: '',
  })
  declare reason: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: AppealStatus;

  // Nombre del mod que la resolvió
  @Column({
    type: DataType.STRING(30),
    allowNull: true,
  })
  declare resolvedBy: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare resolvedAt: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;

  @BelongsTo(() => Star)
  declare star: Star;
}
