import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { MediaType } from '@/channel/channel.settings';

// Índice ligero de TMDB: solo los datos por los que se busca y ordena en SQL.
// La sinopsis y el póster se quedan en la caché de Redis (MovieService.getCached).
@Table({
  tableName: 'Movies',
  timestamps: true,
})
export class MovieMetadata extends Model {
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    primaryKey: true,
    defaultValue: 'movie',
  })
  declare mediaType: MediaType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
  })
  declare tmdbId: number;

  @Column({
    type: DataType.STRING(300),
    allowNull: false,
  })
  declare title: string;

  @Column({
    type: DataType.STRING(300),
    allowNull: true,
  })
  declare originalTitle: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare releaseYear: number | null;

  // Directores separados por coma
  @Column({
    type: DataType.STRING(300),
    allowNull: true,
  })
  declare director: string | null;

  declare createdAt: Date;
  // Se usa para refrescar los datos de TMDB cada cierto tiempo
  declare updatedAt: Date;
}
