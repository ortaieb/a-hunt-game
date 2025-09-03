// src/modules/waypoints/waypoint.service.ts
import { WaypointModel } from './waypoint.model';
import { CreateWaypointSequenceInput, UpdateWaypointSequenceInput } from './waypoint.validator';
import {
  WaypointSequence,
  WaypointSequenceResponse,
  WaypointSequenceFilters,
  WaypointSequenceSummary,
} from './waypoint.types';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/types/errors';
import { instanceToPlain, plainToClass } from 'class-transformer';
import { Waypoint } from '../../schema/waypoints';

export class WaypointService {
  /**
   * Transform waypoint sequence for API response with proper serialization
   */
  private toResponse(sequence: WaypointSequence): WaypointSequenceResponse {
    return {
      ...sequence,
      data: sequence.data.map((waypoint) =>
        instanceToPlain(Object.assign(new Waypoint(), waypoint)),
      ),
    };
  }

  /**
   * Transform waypoint sequence to summary format
   */
  private toSummary(sequence: WaypointSequence): WaypointSequenceSummary {
    return {
      waypoints_id: sequence.waypoints_id,
      waypoint_name: sequence.waypoint_name,
      waypoint_description: sequence.waypoint_description,
      valid_from: sequence.valid_from,
    };
  }

  async createWaypointSequence(data: CreateWaypointSequenceInput): Promise<WaypointSequenceResponse> {
    // Check if waypoint sequence already exists
    const exists = await WaypointModel.waypointNameExists(data.waypoint_name);
    if (exists) {
      const activeSequence = await WaypointModel.findActiveByName(data.waypoint_name);
      if (activeSequence) {
        throw new ConflictError('Waypoint sequence with this name already exists');
      }
    }

    // Convert kebab-case JSON data to internal format using class-transformer
    const internalData = data.data.map((jsonWaypoint) =>
      plainToClass(Waypoint, jsonWaypoint),
    );

    const sequence = await WaypointModel.create({
      ...data,
      data: internalData,
    });

    return this.toResponse(sequence);
  }

  async updateWaypointSequence(
    waypointName: string,
    data: UpdateWaypointSequenceInput,
  ): Promise<WaypointSequenceResponse> {
    if (waypointName !== data.waypoint_name) {
      throw new ValidationError('URL waypoint_name must match body waypoint_name');
    }

    // Convert kebab-case JSON data to internal format using class-transformer
    const internalData = data.data.map((jsonWaypoint) =>
      plainToClass(Waypoint, jsonWaypoint),
    );

    const sequence = await WaypointModel.update(waypointName, {
      ...data,
      data: internalData,
    });

    return this.toResponse(sequence);
  }

  async deleteWaypointSequence(waypointName: string): Promise<void> {
    const existingSequence = await WaypointModel.findActiveByName(waypointName);
    if (!existingSequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    return WaypointModel.delete(waypointName);
  }

  async getWaypointSequence(waypointName: string): Promise<WaypointSequenceResponse> {
    const sequence = await WaypointModel.findActiveByName(waypointName);
    if (!sequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    return this.toResponse(sequence);
  }

  async listWaypointSequences(filters: WaypointSequenceFilters): Promise<WaypointSequenceResponse[]> {
    const sequences = await WaypointModel.list(filters);
    return sequences.map((sequence) => this.toResponse(sequence));
  }

  async getAllActiveWaypointSequences(): Promise<WaypointSequenceResponse[]> {
    const sequences = await WaypointModel.getAllActive();
    return sequences.map((sequence) => this.toResponse(sequence));
  }

  async getWaypointSequencesSummary(): Promise<WaypointSequenceSummary[]> {
    const sequences = await WaypointModel.getAllActive();
    return sequences.map((sequence) => this.toSummary(sequence));
  }
}

export const waypointService = new WaypointService();