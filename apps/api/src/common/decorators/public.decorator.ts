import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记端点为公开访问（跳过 JWT 鉴权），用于注册、登录等无需令牌的接口。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
