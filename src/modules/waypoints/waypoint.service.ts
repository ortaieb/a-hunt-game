// src/modules/waypoints/waypoint.service.ts
import { WaypointModel } from './waypoint.model';
import { CreateWaypointSequenceInput, UpdateWaypointSequenceInput } from './waypoint.validator';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/types/errors';
import { plainToClass } from 'class-transformer';
// import { instanceToPlain, plainToClass } from 'class-transformer';
import { Waypoint, WaypointsRecord } from '../../schema/waypoints';

export class WaypointService {
  async createWaypointSequence(data: CreateWaypointSequenceInput): Promise<WaypointsRecord> {
    // Check if waypoint sequence already exists
    const exists = await WaypointModel.waypointNameExists(data.waypoint_name);
    if (exists) {
      const activeSequence = await WaypointModel.findByName(data.waypoint_name);
      if (activeSequence) {
        throw new ConflictError('Waypoint sequence with this name already exists');
      }
    }

    // Convert kebab-case JSON data to internal format using class-transformer
    const internalData = data.data.map(jsonWaypoint => plainToClass(Waypoint, jsonWaypoint));

    const sequence = await WaypointModel.create({
      ...data,
      data: internalData,
    });

    return sequence;
  }

  async updateWaypointSequence(
    waypointName: string,
    data: UpdateWaypointSequenceInput,
  ): Promise<WaypointsRecord> {
    if (waypointName !== data.waypoint_name) {
      throw new ValidationError('URL waypoint_name must match body waypoint_name');
    }

    // Convert kebab-case JSON data to internal format using class-transformer
    const internalData = data.data.map(jsonWaypoint => plainToClass(Waypoint, jsonWaypoint));

    const updatedRecord = await WaypointModel.update(waypointName, {
      ...data,
      data: internalData,
    });

    return updatedRecord;
  }

  async deleteWaypointSequence(waypointName: string): Promise<void> {
    const existingSequence = await WaypointModel.findByName(waypointName);
    if (!existingSequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    return WaypointModel.delete(waypointName);
  }

  async getWaypointSequence(waypointName: string): Promise<WaypointsRecord> {
    const sequence = await WaypointModel.findByName(waypointName);
    if (!sequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    return sequence;
  }
}

export const waypointService = new WaypointService();
