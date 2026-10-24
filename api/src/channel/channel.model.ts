import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { ChannelSettings } from './channel.settings';

export type ChannelPlatform = 'twitch' | 'kick';

@Table({
  timestamps: true,
})
export class Channel extends Model {
  // ID del canal en la plataforma (en Twitch, el user ID / room-id). No cambia aunque cambie el nombre
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    primaryKey: true,
  })
  declare channelId: string;

  // Nombre actual del canal, siempre en minúsculas. Es el que aparece en la URL y en el chat
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
    unique: true,
  })
  declare channelUsername: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'twitch',
  })
  declare platform: ChannelPlatform;

  @Column({
    type: DataType.STRING(60),
    allowNull: false,
  })
  declare displayName: string;

  @Column({
    type: DataType.STRING(300),
    allowNull: false,
    defaultValue: '',
  })
  declare description: string;

  @Column({
    type: DataType.STRING(7),
    allowNull: false,
    defaultValue: '#ff2a4b',
  })
  declare accentColor: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  declare settings: ChannelSettings;

  declare createdAt: Date;
  declare updatedAt: Date;
}
