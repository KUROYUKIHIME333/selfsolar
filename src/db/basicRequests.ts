import pool from "../config/db.js";
import { TablesFieldsPossibilities } from "../types/dbTypes.js";
import { QueryResult } from "pg";

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

    const where = keys.map((key, i) => `${key} = $${i++}`).join(" AND ");

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
    datas: object,
    fieldsToReturn: string[] = ["*"]
  ) {
    // Transformer le tableau en fragment sql
    const returningFields = fieldsToReturn.join(", ");
    const colomns = Object.keys(datas).join(", ");

    //TODO: debugging to remove
    console.log(`${returningFields}`);
    console.log(`${fieldsToReturn}`);

    //TODO: debugging to remove
    console.log(
      `INSERT INTO ${table} (${colomns}) VALUES (${getValuesCommaSeparated(
        datas
      )})
      RETURNING ${returningFields}`
    );

    const result = await sql`
      INSERT INTO ${table} ${sql(datas)} RETURN ${sql(
      fieldsToReturn.join(", ")
    )}
    `;
    //TODO: debugging to remove
    console.log(result);
    return result[0];
  }

  //MODIFIER DANS UNE TABLE
  public async updateInTable(
    table: string,
    id: string,
    datas: object,
    fieldsToReturn: string[] = ["*"]
  ) {
    // Transformer le tableau en fragment sql
    const returningFields = fieldsToReturn.map((field) => sql(field as string));

    const result = await sql`
      UPDATE ${table} 
      SET ${sql(datas)} 
      WHERE id = ${id}
      RETURNING ${sql(returningFields.join(", "))}
    `;
    return result[0];
  }

  public async softDeleteFromTable(
    table: string,
    id: string,
    fieldsToReturn: string[] = ["*"]
  ) {
    const returningFields = fieldsToReturn.map((field) => sql(field as string));
    return await sql`UPDATE ${table} 
      SET is_delete = true
      WHERE id = ${id}
      RETURNING ${sql(returningFields.join(", "))}`;
  }

  public async hardDeleteFromTable(table: string, id: string) {
    return await sql`DELETE FROM ${table} WHERE id = ${id}`;
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
