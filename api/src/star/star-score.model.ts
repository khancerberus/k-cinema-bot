import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Star } from './star.model';

// Nota de un voto en una categoría (gráficos, sonido...). La nota global del voto está en Star.score
@Table({
  timestamps: false,
  indexes: [
    {
      name: 'star_scores_star_id_category_key',
      unique: true,
      fields: ['starId', 'categoryKey'],
    },
  ],
})
export class StarScore extends Model {
  @ForeignKey(() => Star)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare starId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare categoryKey: string;

  @Column({
    type: DataType.DECIMAL(2, 1),
    allowNull: false,
  })
  declare score: number;

  @BelongsTo(() => Star)
  declare star: Star;
}
