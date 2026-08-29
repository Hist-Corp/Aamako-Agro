import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InquiryStatus, Tier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessActionDto,
  CreateInquiryDto,
  PrivateLabelLeadDto,
  ReviewInquiryDto,
} from './dto/wholesale.dto';

@Injectable()
export class WholesaleService {
  constructor(private prisma: PrismaService) {}

  createInquiry(dto: CreateInquiryDto) {
    return this.prisma.wholesaleInquiry.create({ data: dto });
  }

  /** Staff review flow — approval creates/activates a wholesale account with tier. */
  async review(id: string, reviewerId: string, dto: ReviewInquiryDto) {
    const inquiry = await this.prisma.wholesaleInquiry.findUnique({ where: { id } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== InquiryStatus.PENDING) {
      throw new BadRequestException('Inquiry already reviewed');
    }

    if (dto.status === InquiryStatus.APPROVED) {
      const userId = dto.userId ?? inquiry.requestedUserId;
      if (!userId) {
        throw new BadRequestException(
          'userId is required to approve (account the wholesale tier is granted to)',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('Linked user does not exist');

      const tier = await this.prisma.pricingTier.findUnique({
        where: { tier: dto.tier },
      });
      if (!tier) throw new BadRequestException('Unknown tier');

      await this.prisma.$transaction([
        this.prisma.wholesaleAccount.upsert({
          where: { userId },
          update: { tierId: tier.id, isActive: true, approvedById: reviewerId },
          create: {
            userId,
            tierId: tier.id,
            companyName: inquiry.companyName,
            approvedById: reviewerId,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { role: 'WHOLESALE_CUSTOMER' },
        }),
      ]);
    }

    return this.prisma.wholesaleInquiry.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        reviewedById: reviewerId,
        requestedUserId: dto.userId ?? inquiry.requestedUserId,
      },
    });
  }

  /** Dashboard business approve/reject — wraps the review flow with a simpler DTO. */
  async businessAction(id: string, reviewerId: string, dto: BusinessActionDto) {
    const inquiry = await this.prisma.wholesaleInquiry.findUnique({ where: { id } });
    if (!inquiry) throw new NotFoundException('Business not found');
    if (inquiry.status !== InquiryStatus.PENDING) {
      throw new BadRequestException('Business already reviewed');
    }
    const status = dto.status === 'APPROVED' ? InquiryStatus.APPROVED : InquiryStatus.REJECTED;
    return this.review(id, reviewerId, {
      status,
      tier: dto.priceTier ?? Tier.STARTER,
      reviewNote: dto.reason,
      userId: inquiry.requestedUserId ?? undefined,
    });
  }

  /** Lightweight sample-kit order type — no payment involved. */
  async requestSampleKit(userId: string | undefined, dto: { name: string; email: string; shippingAddress: string; notes?: string }) {
    return this.prisma.order.create({
      data: {
        orderNumber: `SK-${Date.now()}`,
        userId,
        status: 'CONFIRMED',
        paymentTerms: 'PREPAID',
        subtotalCents: 0,
        totalCents: 0,
        contactName: dto.name,
        contactEmail: dto.email,
        shippingAddress: dto.shippingAddress,
        notes: 'SAMPLE_KIT ' + (dto.notes ?? ''),
      },
    });
  }

  createPrivateLabelLead(dto: PrivateLabelLeadDto) {
    return this.prisma.privateLabelLead.create({ data: dto });
  }
}
