import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Star } from './star.model';
import { StarScore } from './star-score.model';
import { StarAppeal } from './star-appeal.model';
import { RatingSession } from './rating-session.model';
import {
  RatingSessionService,
  sessionStarsWhere,
} from './rating-session.service';
import { UserService } from '@/user/user.service';
import { CatalogService, mediaLabel } from '@/movie/catalog.service';
import type { Channel } from '@/channel/channel.model';
import { resolveSettings } from '@/channel/channel.settings';
import type { ChatVoter } from './star.dto';
import { formatScores, parseScores, splitAppealArgs } from './star-input';

const MAX_REASON_LENGTH = 200;

// !apelar: el primer voto es el que cuenta. Si alguien se equivoca, pide corregirlo
// y un mod lo aprueba (el voto se sobrescribe) o lo rechaza.
@Injectable()
export class AppealService {
  constructor(
    @InjectModel(Star)
    private readonly starModel: typeof Star,
    @InjectModel(StarScore)
    private readonly starScoreModel: typeof StarScore,
    @InjectModel(StarAppeal)
    private readonly appealModel: typeof StarAppeal,
    @InjectModel(RatingSession)
    private readonly sessionModel: typeof RatingSession,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly ratingSessionService: RatingSessionService,
    private readonly userService: UserService,
    private readonly catalog: CatalogService,
  ) {}

  async request(channel: Channel, voter: ChatVoter, args: string[]) {
    if (!resolveSettings(channel.settings).appeals.enabled) {
      throw new BadRequestException(
        `Disculpa ${voter.username}, las apelaciones están desactivadas en este canal.`,
      );
    }

    // Solo mientras la votación está abierta
    const { session, info } = await this.ratingSessionService.requireOpen(
      channel.channelId,
    );
    const star = await this.starModel.findOne({
      where: { ...sessionStarsWhere(session), userId: voter.userId },
    });
    if (!star) {
      throw new BadRequestException(
        `Disculpa ${voter.username}, todavía no has votado ${mediaLabel(info)}: usa !star.`,
      );
    }

    const pending = await this.appealModel.findOne({
      where: { starId: star.id, status: 'pending' },
    });
    if (pending) {
      throw new BadRequestException(
        `${voter.username}, ya tienes una apelación pendiente. Espera a que un mod la revise.`,
      );
    }

    const { scoreTokens, reason } = splitAppealArgs(args);
    const parsed = parseScores(scoreTokens, session.categories);
    if (!parsed.ok) {
      throw new BadRequestException(
        `Disculpa ${voter.username}, para apelar ${parsed.error} Ejemplo: !apelar <notas> <motivo>`,
      );
    }

    await this.appealModel.create({
      starId: star.id,
      channelId: channel.channelId,
      sessionId: session.id,
      userId: voter.userId,
      score: parsed.value.score,
      scores: parsed.value.scores,
      reason: reason.slice(0, MAX_REASON_LENGTH),
    });

    const breakdown = formatScores(parsed.value.scores, session.categories);
    return `📝 ${voter.username} pide cambiar su voto de ${Number(star.score)}★ a ${parsed.value.score}★${breakdown ? ` (${breakdown})` : ''}${reason ? `: "${reason.slice(0, MAX_REASON_LENGTH)}"` : ''}. Un mod puede usar !k aprobar @${voter.username} o !k rechazar @${voter.username}.`;
  }

  // Aprobar sobrescribe el voto con lo pedido; la apelación queda como registro
  async resolve(
    channel: Channel,
    username: string,
    approve: boolean,
    moderator: string,
  ) {
    const user = await this.userService.getByUsername(username);
    const appeal = user
      ? await this.appealModel.findOne({
          where: {
            channelId: channel.channelId,
            userId: user.userId,
            status: 'pending',
          },
          order: [['createdAt', 'DESC']],
        })
      : null;
    if (!user || !appeal) {
      throw new NotFoundException(
        `${username} no tiene ninguna apelación pendiente.`,
      );
    }

    const star = await this.starModel.findByPk(appeal.starId);
    if (!star) {
      throw new NotFoundException('El voto de esa apelación ya no existe.');
    }

    const resolvedAt = new Date();
    if (!approve) {
      await appeal.update({
        status: 'rejected',
        resolvedBy: moderator,
        resolvedAt,
      });
      return `❌ Apelación de ${user.username} rechazada: su voto se queda en ${Number(star.score)}★.`;
    }

    await this.sequelize.transaction(async (transaction) => {
      await star.update({ score: appeal.score }, { transaction });
      for (const [categoryKey, score] of Object.entries(appeal.scores)) {
        const [updated] = await this.starScoreModel.update(
          { score },
          { where: { starId: star.id, categoryKey }, transaction },
        );
        if (!updated) {
          await this.starScoreModel.create(
            { starId: star.id, categoryKey, score },
            { transaction },
          );
        }
      }
      await appeal.update(
        { status: 'approved', resolvedBy: moderator, resolvedAt },
        { transaction },
      );
    });

    const session = appeal.sessionId
      ? await this.sessionModel.findByPk(appeal.sessionId)
      : null;
    const info = await this.catalog.getInfo(star.mediaType, star.tmdbId);
    const breakdown = formatScores(appeal.scores, session?.categories ?? []);
    return `✅ Apelación aprobada: ${user.username} ahora da ${Number(appeal.score)}★${breakdown ? ` (${breakdown})` : ''}${info ? ` a ${mediaLabel(info)}` : ''}.`;
  }
}
