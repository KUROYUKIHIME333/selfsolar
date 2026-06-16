import pool from "../config/db.js";
import { TablesFieldsPossibilities } from "../types/dbTypes.js";

export class BasicRequests {
  // RECUPERER UNE TABLE
  public async selectAllFromTable(table: string) {
    const result = await pool.query(`SELECT * FROM ${table}`);
    return result.rows;
  }

  // RECUPERER PAR UN CHAMPS (egalité stricte)
  public async selectByFieldFromTable(
    table: string,
    conditions: Record<string, unknown>
  ) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);

    const where = keys.map((key, i) => `${key} = $${i+1}`).join(" AND ");

    const result = await pool.query(
      `SELECT * FROM ${table} WHERE ${where}`,
      values
    );

    return result.rows;
  }

  // RECUPERER PAR UN CHAMPS PAR L ID(egalité stricte)
  public async selectByIdFromTable(table: string, id: string) {
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ?? null;
  }

  //INSERER DANS UNE TABLE DES VALEURS ET RETOURNER DES CHAMPS
  public async insertValuesIntoTable(
    table: string,
    datas: Record<string, unknown>,
    fieldsToReturn: string[] = ["*"]
  ) {
    const keys = Object.keys(datas);
    const values = Object.values(datas);

    const columns = keys.join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const returning = fieldsToReturn.join(", ");

    const result = await pool.query(
      `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING ${returning}
  `,
      values
    );

    return result.rows[0];
  }

  //MODIFIER DANS UNE TABLE
  public async updateInTable(
    table: string,
    id: string,
    datas: Record<string, unknown>,
    fieldsToReturn: string[] = ["*"]
  ) {
    const keys = Object.keys(datas);
    const values = Object.values(datas);

    const clauses = keys.map((key, i) => `${key}=$${i+1}`).join(", ");
    const idPlaceholder = `$${keys.length + 1}`;
    const returning = fieldsToReturn.join(", ");

    const result = await pool.query(
      `UPDATE ${table} 
      SET ${clauses} 
      WHERE id = ${idPlaceholder}
      RETURNING ${returning}
    `,
      [...values, id]
    );

    return result.rows[0] ?? null;
  }

  // SUPPRESSION LOGIQUE
  public async softDeleteFromTable(
    table: string,
    id: string,
    fieldsToReturn: string[] = ["*"]
  ) {
    const result = await this.updateInTable(table, id, {is_delete: true}, fieldsToReturn);

    return result;

  }

  public async hardDeleteFromTable(table: string, id: string) {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  public async countAllFromTable(
    table: string,
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    let result = await sql`SELECT COUNT(*) FROM ${sql(
      table
    )} WHERE is_delete = false`;

    if (criteria === "all") {
      result = await sql`SELECT COUNT(*) FROM ${table}`;
    }
    if (criteria === "deleted") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE is_delete = true`;
    }

    return result[0]?.count;
  }

  public async countByAFieldFromTable(
    table: string,
    fieldName: string,
    fieldValue: TablesFieldsPossibilities,
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    let result = await sql`SELECT COUNT(*) FROM ${sql(
      table
    )} WHERE is_delete = false AND WHERE ${fieldName} = ${fieldValue}`;

    if (criteria === "all") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE ${fieldName} = ${fieldValue}`;
    }
    if (criteria === "deleted") {
      result = await sql`SELECT COUNT(*) FROM ${sql(
        table
      )} WHERE is_delete = true WHERE ${fieldName} = ${fieldValue}`;
    }

    return result[0]?.count;
  }
}

export const basicRequests = new BasicRequests();
