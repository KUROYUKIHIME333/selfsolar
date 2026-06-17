import pool from "../lib/db.js";

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

    const where = keys.map((key, i) => `${key} = $${i + 1}`).join(" AND ");

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
    return result.rows;
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

    return result.rows;
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

    const clauses = keys.map((key, i) => `${key}=$${i + 1}`).join(", ");
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

    return result.rows;
  }

  // SUPPRESSION LOGIQUE
  public async softDeleteFromTable(
    table: string,
    id: string,
    fieldsToReturn: string[] = ["*"]
  ) {
    const result = await this.updateInTable(
      table,
      id,
      { is_delete: true },
      fieldsToReturn
    );

    return result;
  }

  // SUPPRESSION DEFINITIVE
  public async hardDeleteFromTable(table: string, id: string) {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // COMPTER LES ENREGISTREMENTS DANS UNE TABLE SELON UN CRITERE (tous, supprimés, non supprimés)
  public async countAllFromTable(
    table: string,
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let query = `SELECT COUNT(*) FROM ${table}`;

    if (criteria === "active") {
      conditions.push("is_delete = false");
    }
    if (criteria === "deleted") {
      conditions.push("is_delete = true");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  // COMPTER LES ENREGISTREMENTS DANS UNE TABLE SELON UN CHAMPS ET UN CRITERE (tous, supprimés, non supprimés)
  public async countByAFieldFromTable(
    table: string,
    datas: Record<string, unknown>, // On utilise l'objet comme pour l'insert
    criteria: "all" | "active" | "deleted" = "active"
  ) {
    const keys = Object.keys(datas);
    const values = Object.values(datas);
    let query = `SELECT COUNT(*) FROM ${table} WHERE 1=1`;

    const dynamicConditions = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(" AND ");

    query += ` AND ${dynamicConditions}`;

    if (criteria === "active") {
      query += " AND is_delete = false";
    } else if (criteria === "deleted") {
      query += " AND is_delete = true";
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }
}

export const basicRequests = new BasicRequests();
