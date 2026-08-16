import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1786882695159 implements MigrationInterface {
  name = "CreateUsers1786882695159";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "telegram_user_id" bigint NOT NULL,
        "strava_athlete_id" bigint NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL DEFAULT '',
        "strava_access_token_encrypted" text NOT NULL,
        "strava_refresh_token_encrypted" text NOT NULL,
        "strava_token_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_telegram_user_id" UNIQUE ("telegram_user_id"),
        CONSTRAINT "UQ_users_strava_athlete_id" UNIQUE ("strava_athlete_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
