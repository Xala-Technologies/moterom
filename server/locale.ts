import type { Request } from "express";
import {
  LOCALE_COOKIE,
  parseCookie,
  resolveLocale,
  type Locale,
} from "../shared/i18n/locale";
import { translateMessage } from "../shared/i18n/messages";
import { AppError } from "../shared/validation";

export function requestLocale(req: Request): Locale {
  return resolveLocale(
    parseCookie(req.headers.cookie, LOCALE_COOKIE),
    req.headers["accept-language"],
  );
}

export function fail(
  status: number,
  code: string,
  params?: Record<string, string | number>,
  locale: Locale = "nb",
) {
  return new AppError(
    status,
    translateMessage(locale, code, params),
    code,
    params,
  );
}

export function localizeError(error: unknown, locale: Locale) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: translateMessage(
        locale,
        error.code,
        error.params,
        error.message,
      ),
    };
  }
  return null;
}
